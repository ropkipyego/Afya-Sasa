import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Patient } from '../patients/patient.entities';
import { InitiateMpesaStkDto, RecordManualPaymentDto } from './payments.dto';
import { PaymentTransaction, QuickbooksSyncQueueItem, type PaymentServiceLine } from './payment.entities';
import { MpesaService } from './mpesa.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactions: Repository<PaymentTransaction>,
    @InjectRepository(QuickbooksSyncQueueItem)
    private readonly qbQueue: Repository<QuickbooksSyncQueueItem>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(LabRequest) private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    private readonly mpesa: MpesaService,
  ) {}

  async initiateMpesaStk(dto: InitiateMpesaStkDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const serviceEntityId = dto.serviceEntityId ?? dto.labRequestId ?? null;
    const labRequest = await this.resolveLabRequest(dto.serviceLine, serviceEntityId, dto.labRequestId);
    const encounterId = dto.encounterId ?? labRequest?.encounter?.id ?? null;

    const accountReference =
      dto.accountReference ??
      labRequest?.requestNo ??
      patient.patientNo ??
      dto.patientId.slice(0, 8);

    const stk = await this.mpesa.initiateStkPush({
      phone: dto.phone,
      amount: dto.amount,
      accountReference,
      description: dto.description ?? dto.serviceDescription ?? 'AfyaSasa payment',
    });

    const txn = await this.transactions.save(
      this.transactions.create({
        patient,
        encounter: encounterId ? ({ id: encounterId } as Encounter) : null,
        labRequest,
        serviceLine: dto.serviceLine,
        serviceEntityId,
        serviceDescription: dto.serviceDescription ?? null,
        method: 'mpesa',
        payerScheme: null,
        amount: String(dto.amount),
        currency: 'KES',
        status: 'initiated',
        externalReference: stk.checkoutRequestId,
        mpesaPhone: this.mpesa.normalizePhone(dto.phone),
        metadata: { merchantRequestId: stk.merchantRequestId, mock: stk.mock },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    await this.applyPendingPayment(labRequest, encounterId, {
      paymentMethod: 'mpesa',
      mpesaPhone: this.mpesa.normalizePhone(dto.phone),
      billingAmount: String(dto.amount),
      paymentStatus: 'pending',
      updatedBy: request.user?.sub ?? null,
    });

    return { transaction: txn, stk };
  }

  async recordManualPayment(dto: RecordManualPaymentDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const serviceEntityId = dto.serviceEntityId ?? dto.labRequestId ?? null;
    const labRequest = await this.resolveLabRequest(dto.serviceLine, serviceEntityId, dto.labRequestId);
    const encounterId = dto.encounterId ?? labRequest?.encounter?.id ?? null;

    const txn = await this.transactions.save(
      this.transactions.create({
        patient,
        labRequest,
        encounter: encounterId ? ({ id: encounterId } as Encounter) : null,
        serviceLine: dto.serviceLine,
        serviceEntityId,
        serviceDescription: dto.serviceDescription ?? null,
        method: dto.method,
        payerScheme: dto.payerScheme ?? null,
        amount: dto.amount != null ? String(dto.amount) : null,
        currency: 'KES',
        status: 'completed',
        externalReference: dto.reference ?? null,
        mpesaPhone: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    await this.applyCompletedPayment({
      serviceLine: dto.serviceLine,
      labRequest,
      encounterId,
      method: dto.method,
      payerScheme: dto.payerScheme ?? null,
      reference: dto.reference ?? undefined,
      amount: dto.amount,
      updatedBy: request.user?.sub ?? null,
    });

    if (dto.method === 'quickbooks') {
      await this.enqueueQuickbooks('payment', txn.id, 'payment_add', {
        patientNo: patient.patientNo,
        serviceLine: dto.serviceLine,
        serviceEntityId,
        reference: dto.reference,
        amount: dto.amount,
      });
    }

    return txn;
  }

  async handleMpesaCallback(body: Record<string, unknown>) {
    const parsed = this.mpesa.parseCallback(body);
    if (!parsed.checkoutRequestId) return { ok: false };

    const txn = await this.transactions.findOne({
      where: { externalReference: parsed.checkoutRequestId },
      relations: { labRequest: true, encounter: true },
    });
    if (!txn) return { ok: false, reason: 'transaction_not_found' };

    if (parsed.success) {
      await this.transactions.update(txn.id, {
        status: 'completed',
        externalReference: parsed.mpesaReceiptNumber ?? txn.externalReference,
        rawCallback: parsed.raw as never,
        amount: parsed.amount != null ? String(parsed.amount) : txn.amount,
      });
      await this.applyCompletedPayment({
        serviceLine: txn.serviceLine ?? 'other',
        labRequest: txn.labRequest,
        encounterId: txn.encounter?.id ?? null,
        method: 'mpesa',
        payerScheme: null,
        reference: parsed.mpesaReceiptNumber ?? undefined,
        amount: parsed.amount ?? undefined,
        updatedBy: null,
      });
      if (txn.serviceLine === 'laboratory' && txn.serviceEntityId) {
        await this.enqueueQuickbooks('lab_request', txn.serviceEntityId, 'invoice_add', {
          labRequestId: txn.serviceEntityId,
          mpesaReceipt: parsed.mpesaReceiptNumber,
          amount: parsed.amount,
        });
      }
    } else {
      await this.transactions.update(txn.id, {
        status: 'failed',
        rawCallback: parsed.raw as never,
      });
      if (txn.labRequest) {
        await this.labRequests.update(txn.labRequest.id, { paymentStatus: 'failed' });
      }
    }

    return { ok: true };
  }

  listTransactions(limit = 50, patientId?: string) {
    return this.transactions.find({
      where: patientId ? { patient: { id: patientId } } : {},
      relations: { patient: true, labRequest: true, encounter: true },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  listQuickbooksQueue(status?: 'pending' | 'synced' | 'failed') {
    return this.qbQueue.find({
      where: status ? { status } : {},
      order: { createdAt: 'ASC' },
      take: 100,
    });
  }

  async markQuickbooksSynced(id: string, quickbooksTxnId: string) {
    await this.qbQueue.update(id, {
      status: 'synced',
      quickbooksTxnId,
      syncedAt: new Date(),
    });
    return this.qbQueue.findOne({ where: { id } });
  }

  private async resolveLabRequest(
    serviceLine: PaymentServiceLine,
    serviceEntityId: string | null,
    legacyLabRequestId?: string,
  ) {
    const labRequestId =
      serviceLine === 'laboratory' ? serviceEntityId ?? legacyLabRequestId ?? null : legacyLabRequestId ?? null;
    if (!labRequestId) return null;
    return this.labRequests.findOne({
      where: { id: labRequestId },
      relations: { encounter: true },
    });
  }

  private async applyPendingPayment(
    labRequest: LabRequest | null,
    encounterId: string | null,
    update: {
      paymentMethod: string;
      mpesaPhone?: string;
      billingAmount?: string;
      paymentStatus: LabRequest['paymentStatus'];
      updatedBy: string | null;
    },
  ) {
    if (labRequest) {
      await this.labRequests.update(labRequest.id, {
        paymentMethod: update.paymentMethod,
        mpesaPhone: update.mpesaPhone ?? null,
        billingAmount: update.billingAmount ?? labRequest.billingAmount,
        paymentStatus: update.paymentStatus,
        updatedBy: update.updatedBy,
      });
    }
    if (encounterId && update.paymentMethod) {
      await this.encounters.update(encounterId, {
        paymentMethod: update.paymentMethod as Encounter['paymentMethod'],
        receiptNumber: null,
        updatedBy: update.updatedBy,
      });
    }
  }

  private async applyCompletedPayment(params: {
    serviceLine: PaymentServiceLine;
    labRequest: LabRequest | null;
    encounterId: string | null;
    method: string;
    payerScheme: string | null;
    reference?: string;
    amount?: number;
    updatedBy: string | null;
  }) {
    const paymentStatus =
      params.method === 'insurance' ? 'insurance_pending' : params.method === 'waived' ? 'waived' : 'paid';

    if (params.labRequest) {
      await this.labRequests.update(params.labRequest.id, {
        paymentMethod: params.method,
        payerScheme: params.payerScheme,
        paymentReference: params.reference ?? null,
        paymentStatus,
        billingAmount:
          params.amount != null ? String(params.amount) : params.labRequest.billingAmount,
        updatedBy: params.updatedBy,
      });
    }

    if (params.encounterId) {
      await this.encounters.update(params.encounterId, {
        paymentMethod: params.method as Encounter['paymentMethod'],
        receiptNumber: params.reference ?? null,
        updatedBy: params.updatedBy,
      });
    }
  }

  private async enqueueQuickbooks(
    entityType: QuickbooksSyncQueueItem['entityType'],
    entityId: string,
    action: QuickbooksSyncQueueItem['action'],
    payload: Record<string, unknown>,
  ) {
    return this.qbQueue.save(
      this.qbQueue.create({
        entityType,
        entityId,
        action,
        payload,
        status: 'pending',
      }),
    );
  }
}
