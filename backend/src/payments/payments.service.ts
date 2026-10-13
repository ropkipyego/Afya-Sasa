import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Patient } from '../patients/patient.entities';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { prescriptionGroupId } from '../clinical-order/pharmacy-prescription';
import { Charge, chargeRemaining, chargesEnabled } from './charge.entities';
import { InitiateMpesaStkDto, RecordManualPaymentDto, RefundPaymentDto } from './payments.dto';
import { PaymentTransaction, QuickbooksSyncQueueItem, type PaymentServiceLine } from './payment.entities';
import { amountsMatch } from './mpesa-callback.contract';
import { MpesaService } from './mpesa.service';
import {
  cashierTotals,
  isRefundMetadata,
  payerMixFromMethods,
  remainingBalance,
} from './payment-integrity';

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
    @InjectRepository(ClinicalOrder) private readonly clinicalOrders: Repository<ClinicalOrder>,
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    private readonly mpesa: MpesaService,
  ) {}

  async initiateMpesaStk(dto: InitiateMpesaStkDto, request: RequestContext) {
    this.assertAmount(dto.amount, false);
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    await this.assertNoRecentDuplicate({
      patientId: patient.id,
      amount: dto.amount,
      method: 'mpesa',
      serviceLine: dto.serviceLine,
    });

    const serviceEntityId = dto.serviceEntityId ?? dto.labRequestId ?? null;
    const labRequest = await this.resolveLabRequest(dto.serviceLine, serviceEntityId, dto.labRequestId);
    const encounterId = dto.encounterId ?? labRequest?.encounter?.id ?? null;
    const charge = await this.lockChargeForPayment(dto.chargeId, patient.id, dto.amount, false);

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
        chargeId: charge?.id ?? null,
        metadata: {
          merchantRequestId: stk.merchantRequestId,
          mock: stk.mock,
          ...(charge ? { chargeId: charge.id } : {}),
        },
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
    const amount = dto.method === 'waived' ? dto.amount ?? 0 : dto.amount;
    this.assertAmount(amount, dto.method === 'waived');
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    if (dto.idempotencyKey?.trim()) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey.trim());
      if (existing) return existing;
    }
    if (amount != null) {
      await this.assertNoRecentDuplicate({
        patientId: patient.id,
        amount,
        method: dto.method,
        serviceLine: dto.serviceLine,
      });
    }

    const serviceEntityId = dto.serviceEntityId ?? dto.labRequestId ?? null;
    const labRequest = await this.resolveLabRequest(dto.serviceLine, serviceEntityId, dto.labRequestId);
    const encounterId = dto.encounterId ?? labRequest?.encounter?.id ?? null;
    const charge = await this.lockChargeForPayment(dto.chargeId, patient.id, amount ?? 0, dto.method === 'waived');
    const receiptNo = dto.reference?.trim() || (await this.nextHospitalReceiptNo());

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
        amount: amount != null ? String(amount) : null,
        currency: 'KES',
        status: 'completed',
        externalReference: receiptNo,
        mpesaPhone: null,
        chargeId: charge?.id ?? null,
        metadata: {
          ...(charge ? { chargeId: charge.id } : {}),
          ...(dto.idempotencyKey?.trim() ? { idempotencyKey: dto.idempotencyKey.trim() } : {}),
          kind: 'payment',
        },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    if (charge && amount != null) {
      await this.applyPaymentToCharge(charge, amount, dto.method === 'waived');
    }

    await this.applyCompletedPayment({
      serviceLine: dto.serviceLine,
      labRequest,
      encounterId,
      method: dto.method,
      payerScheme: dto.payerScheme ?? null,
      reference: receiptNo,
      amount,
      updatedBy: request.user?.sub ?? null,
    });

    if (dto.method === 'quickbooks') {
      await this.enqueueQuickbooks('payment', txn.id, 'payment_add', {
        patientNo: patient.patientNo,
        serviceLine: dto.serviceLine,
        serviceEntityId,
        reference: dto.reference,
        amount,
      });
    }

    return txn;
  }

  async handleMpesaCallback(body: Record<string, unknown>) {
    const parsed = this.mpesa.parseCallback(body);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };

    const txn = await this.transactions.findOne({
      where: { externalReference: parsed.checkoutRequestId },
      relations: { labRequest: true, encounter: true, patient: true },
    });
    if (!txn) return { ok: false, reason: 'transaction_not_found' };

    if (!parsed.success) {
      const claimed = await this.transactions
        .createQueryBuilder()
        .update()
        .set({ status: 'failed', rawCallback: parsed.raw as never })
        .where('id = :id AND status = :status', { id: txn.id, status: 'initiated' })
        .execute();
      if (!claimed.affected) {
        return { ok: true, duplicate: true };
      }
      if (txn.labRequest) {
        await this.labRequests.update(txn.labRequest.id, { paymentStatus: 'failed' });
      }
      return { ok: true, duplicate: false };
    }

    if (!parsed.mpesaReceiptNumber) {
      return { ok: false, reason: 'missing_receipt' };
    }
    if (!amountsMatch(txn.amount, parsed.amount)) {
      return { ok: false, reason: 'amount_mismatch' };
    }

    const claimed = await this.transactions
      .createQueryBuilder()
      .update()
      .set({
        status: 'completed',
        rawCallback: parsed.raw as never,
        metadata: {
          ...(txn.metadata ?? {}),
          checkoutRequestId: parsed.checkoutRequestId,
          mpesaReceiptNumber: parsed.mpesaReceiptNumber,
        },
      })
      .where('id = :id AND status = :status', { id: txn.id, status: 'initiated' })
      .execute();

    let current = txn;
    if (!claimed.affected) {
      current =
        (await this.transactions.findOne({
          where: { id: txn.id },
          relations: { labRequest: true, encounter: true, patient: true },
        })) ?? txn;
      if (current.status !== 'completed') {
        return { ok: false, reason: 'transaction_not_open' };
      }
    }

    await this.finalizeMpesaSuccess(current, parsed);
    return { ok: true, duplicate: !claimed.affected };
  }

  /**
   * Resume-safe STK success work after the initiated→completed claim.
   * Stage flags live on existing jsonb `metadata.mpesaFinalization` — no migration.
   * A dedicated finalization_status column plus a unique QB (entity_type, entity_id, action, payment_id)
   * index would be cleaner; do not apply that schema in this change.
   */
  private async finalizeMpesaSuccess(
    txn: PaymentTransaction,
    parsed: {
      mpesaReceiptNumber: string | null;
      amount: number | null;
      checkoutRequestId: string;
    },
  ) {
    const paidAmount = Number(txn.amount);
    if (await this.claimFinalizationStage(txn.id, 'charge')) {
      try {
        const chargeId =
          txn.chargeId ??
          (txn.metadata && typeof txn.metadata.chargeId === 'string' ? txn.metadata.chargeId : null);
        if (chargeId && txn.patient?.id) {
          if (Number.isFinite(paidAmount) && paidAmount > 0) {
            const charge = await this.lockChargeForPayment(chargeId, txn.patient.id, paidAmount, false);
            if (charge) await this.applyPaymentToCharge(charge, paidAmount, false);
          }
        }
      } catch (error) {
        await this.unclaimFinalizationStage(txn.id, 'charge');
        throw error;
      }
    }

    if (await this.claimFinalizationStage(txn.id, 'downstream')) {
      try {
        await this.applyCompletedPayment({
          serviceLine: txn.serviceLine ?? 'other',
          labRequest: txn.labRequest,
          encounterId: txn.encounter?.id ?? null,
          method: 'mpesa',
          payerScheme: null,
          reference: parsed.mpesaReceiptNumber ?? undefined,
          amount: Number.isFinite(paidAmount) ? paidAmount : undefined,
          updatedBy: null,
        });
      } catch (error) {
        await this.unclaimFinalizationStage(txn.id, 'downstream');
        throw error;
      }
    }

    if (txn.serviceLine === 'laboratory' && txn.serviceEntityId) {
      if (await this.claimFinalizationStage(txn.id, 'quickbooks')) {
        try {
          await this.enqueueQuickbooksOnce('lab_request', txn.serviceEntityId, 'invoice_add', {
            labRequestId: txn.serviceEntityId,
            paymentId: txn.id,
            mpesaReceipt: parsed.mpesaReceiptNumber,
            amount: paidAmount,
            checkoutRequestId: parsed.checkoutRequestId,
          });
        } catch (error) {
          await this.unclaimFinalizationStage(txn.id, 'quickbooks');
          throw error;
        }
      }
    }
  }

  private async claimFinalizationStage(transactionId: string, stage: 'charge' | 'downstream' | 'quickbooks') {
    const result = await this.transactions
      .createQueryBuilder()
      .update()
      .set({
        metadata: () =>
          `jsonb_set(COALESCE(metadata, '{}'::jsonb), '{mpesaFinalization,${stage}}', 'true'::jsonb, true)`,
      })
      .where('id = :id', { id: transactionId })
      .andWhere(`COALESCE(metadata->'mpesaFinalization'->>'${stage}', 'false') <> 'true'`)
      .execute();
    return (result.affected ?? 0) > 0;
  }

  private async unclaimFinalizationStage(transactionId: string, stage: 'charge' | 'downstream' | 'quickbooks') {
    await this.transactions
      .createQueryBuilder()
      .update()
      .set({
        metadata: () =>
          `jsonb_set(COALESCE(metadata, '{}'::jsonb), '{mpesaFinalization,${stage}}', 'false'::jsonb, true)`,
      })
      .where('id = :id', { id: transactionId })
      .execute();
  }

  listTransactions(limit = 50, patientId?: string) {
    return this.transactions.find({
      where: patientId ? { patient: { id: patientId } } : {},
      relations: { patient: true, labRequest: true, encounter: true },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  listCharges(patientId: string) {
    return this.charges.find({
      where: { patient: { id: patientId } },
      relations: { encounter: true },
      order: { createdAt: 'DESC' },
      take: 80,
    });
  }

  async patientStatement(patientId: string) {
    const patient = await this.patients.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const [charges, payments] = await Promise.all([
      this.charges.find({
        where: { patient: { id: patientId } },
        relations: { encounter: true },
        order: { createdAt: 'ASC' },
        take: 200,
      }),
      this.transactions.find({
        where: { patient: { id: patientId } },
        order: { createdAt: 'ASC' },
        take: 200,
      }),
    ]);
    const owed = charges.reduce((sum, row) => sum + Number(row.amountOwed), 0);
    const paid = charges.reduce((sum, row) => sum + Number(row.amountPaid), 0);
    const waived = charges.reduce((sum, row) => sum + Number(row.amountWaived), 0);
    const collections = payments.filter(
      (row) => row.status === 'completed' && !isRefundMetadata(row.metadata),
    );
    const refunds = payments.filter(
      (row) => row.status === 'completed' && isRefundMetadata(row.metadata),
    );
    return {
      patient: { id: patient.id, patientNo: patient.patientNo, name: `${patient.firstName} ${patient.lastName}` },
      charges: charges.map((row) => ({
        id: row.id,
        encounterId: row.encounter?.id ?? null,
        serviceLine: row.serviceLine,
        serviceDescription: row.serviceDescription,
        amountOwed: Number(row.amountOwed),
        amountPaid: Number(row.amountPaid),
        amountWaived: Number(row.amountWaived),
        remaining: remainingBalance(Number(row.amountOwed), Number(row.amountPaid), Number(row.amountWaived)),
        status: row.status,
        createdAt: row.createdAt,
      })),
      payments: payments.map((row) => ({
        id: row.id,
        kind: isRefundMetadata(row.metadata) ? 'refund' : 'payment',
        method: row.method,
        status: row.status,
        amount: Number(row.amount ?? 0),
        receipt: row.externalReference,
        chargeId: row.chargeId,
        createdAt: row.createdAt,
        originalPaymentId: row.metadata?.originalPaymentId ?? null,
      })),
      totals: {
        chargesRaised: owed,
        paymentsReceived: collections.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        refunds: refunds.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        waived,
        outstanding: remainingBalance(owed, paid, waived),
      },
    };
  }

  async cashierSummary(from: string, to: string) {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('Invalid date range');
    }
    const rows = await this.transactions
      .createQueryBuilder('txn')
      .where('txn.createdAt BETWEEN :start AND :end', { start, end })
      .orderBy('txn.createdAt', 'ASC')
      .take(2000)
      .getMany();
    const totals = cashierTotals(rows);
    const unmatched = rows.filter(
      (row) => row.status === 'completed' && !row.chargeId && !isRefundMetadata(row.metadata),
    );
    return {
      from,
      to,
      generatedAt: new Date().toISOString(),
      collections: totals.collections,
      refunds: totals.refunds,
      unmatchedCount: unmatched.length,
      unmatchedAmount: unmatched.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      collectionsByMethod: totals.collectionsByMethod,
      payerMix: payerMixFromMethods(totals.collectionsByMethod),
      note: 'Collections exclude refunds. Insurance method is not remittance received.',
    };
  }

  async refundPayment(id: string, dto: RefundPaymentDto, request: RequestContext) {
    const original = await this.transactions.findOne({
      where: { id },
      relations: { patient: true, encounter: true, labRequest: true },
    });
    if (!original) throw new NotFoundException('Payment not found');
    if (original.status !== 'completed') {
      throw new BadRequestException('Only completed payments can be refunded');
    }
    if (isRefundMetadata(original.metadata)) {
      throw new BadRequestException('This row is already a refund');
    }
    if (original.metadata?.refundedBy) {
      throw new BadRequestException('This payment already has a refund');
    }
    const max = Number(original.amount ?? 0);
    const amount = dto.amount ?? max;
    if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
      throw new BadRequestException('Refund amount must be within the original payment');
    }
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('A refund reason is required');

    const refund = await this.transactions.save(
      this.transactions.create({
        patient: original.patient,
        encounter: original.encounter,
        labRequest: original.labRequest,
        serviceLine: original.serviceLine,
        serviceEntityId: original.serviceEntityId,
        serviceDescription: original.serviceDescription,
        method: original.method,
        payerScheme: original.payerScheme,
        amount: String(amount),
        currency: original.currency,
        status: 'completed',
        externalReference: `RF-${original.externalReference ?? original.id.slice(0, 8)}`,
        chargeId: original.chargeId,
        metadata: {
          kind: 'refund',
          originalPaymentId: original.id,
          reason,
        },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    original.metadata = {
      ...(original.metadata ?? {}),
      refundedBy: refund.id,
      refundedAt: new Date().toISOString(),
    };
    await this.transactions.save(original);

    if (original.chargeId && chargesEnabled()) {
      const charge = await this.charges.findOne({ where: { id: original.chargeId } });
      if (charge) {
        charge.amountPaid = String(Math.max(0, Number(charge.amountPaid) - amount));
        const remaining = remainingBalance(
          Number(charge.amountOwed),
          Number(charge.amountPaid),
          Number(charge.amountWaived),
        );
        charge.status = remaining <= 0 ? 'paid' : Number(charge.amountPaid) > 0 ? 'partially_paid' : 'owed';
        await this.charges.save(charge);
      }
    }
    return refund;
  }

  async upsertPharmacyCharge(params: {
    patientId: string;
    encounterId: string | null;
    admissionId?: string | null;
    serviceEntityId: string;
    description: string;
    amountDelta: number;
    orderNo?: string;
    userId: string | null;
  }) {
    if (!chargesEnabled()) return null;
    if (!Number.isFinite(params.amountDelta) || params.amountDelta <= 0) return null;

    const existing = await this.charges.findOne({
      where: {
        serviceLine: 'pharmacy',
        serviceEntityId: params.serviceEntityId,
        status: In(['owed', 'partially_paid', 'paid']),
      },
      relations: { patient: true, encounter: true },
    });

    if (existing && existing.status !== 'cancelled' && existing.status !== 'waived') {
      existing.amountOwed = String(Number(existing.amountOwed) + params.amountDelta);
      existing.serviceDescription = params.description;
      existing.metadata = {
        ...(existing.metadata ?? {}),
        orderNo: params.orderNo ?? existing.metadata?.orderNo,
        admissionId: params.admissionId ?? existing.metadata?.admissionId ?? null,
        source: 'PHARMACY',
        kind: 'pharmacy_dispense',
      };
      existing.status = chargeRemaining(existing) <= 0 ? 'paid' : Number(existing.amountPaid) > 0 ? 'partially_paid' : 'owed';
      existing.updatedBy = params.userId;
      return this.charges.save(existing);
    }

    return this.charges.save(
      this.charges.create({
        patient: { id: params.patientId } as Patient,
        encounter: params.encounterId ? ({ id: params.encounterId } as Encounter) : null,
        serviceLine: 'pharmacy',
        serviceEntityId: params.serviceEntityId,
        serviceDescription: params.description,
        amountOwed: String(params.amountDelta),
        amountPaid: '0',
        amountWaived: '0',
        currency: 'KES',
        status: 'owed',
        metadata: {
          orderNo: params.orderNo,
          kind: 'pharmacy_dispense',
          source: 'PHARMACY',
          admissionId: params.admissionId ?? null,
        },
        createdBy: params.userId,
        updatedBy: params.userId,
      }),
    );
  }

  async listOutstandingPharmacy(patientId: string) {
    const patient = await this.patients.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    if (chargesEnabled()) {
      const open = await this.charges.find({
        where: {
          patient: { id: patientId },
          status: In(['owed', 'partially_paid']),
        },
        relations: { encounter: true },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      if (open.length) {
        return open.map((charge) => ({
          serviceLine: charge.serviceLine,
          serviceEntityId: charge.serviceEntityId ?? charge.id,
          chargeId: charge.id,
          encounterId: charge.encounter?.id ?? null,
          orderNo: String(charge.metadata?.orderNo ?? charge.serviceDescription),
          description: charge.serviceDescription,
          dispensedAt: charge.createdAt,
          amountOwed: Number(charge.amountOwed),
          amountPaid: Number(charge.amountPaid),
          remaining: chargeRemaining(charge),
        }));
      }
    }

    const orders = await this.clinicalOrders.find({
      where: {
        patient: { id: patientId },
        orderType: 'pharmacy',
        status: In(['dispensed', 'partially_dispensed']),
      },
      relations: { patient: true, encounter: true },
      order: { completedAt: 'DESC' },
      take: 80,
    });
    if (!orders.length) return [];
    const paid = await this.transactions.find({
      where: {
        patient: { id: patientId },
        serviceLine: 'pharmacy',
        status: In(['completed', 'initiated']),
      },
    });
    const paidIds = new Set(
      paid.flatMap((row) => {
        const chargeId = row.metadata && typeof row.metadata.chargeId === 'string' ? row.metadata.chargeId : null;
        return [row.serviceEntityId, chargeId].filter(Boolean);
      }),
    );

    const groups = new Map<string, typeof orders>();
    for (const order of orders) {
      if (order.metadata?.kind === 'prescription') continue;
      const groupId = prescriptionGroupId(order);
      const list = groups.get(groupId) ?? [];
      list.push(order);
      groups.set(groupId, list);
    }

    return [...groups.entries()]
      .filter(([groupId, lines]) => !paidIds.has(groupId) && !lines.some((line) => paidIds.has(line.id)))
      .map(([groupId, lines]) => {
        const names = lines.map((order) => {
          const qty = Number(order.metadata?.dispensedQuantity ?? order.metadata?.quantity ?? 0);
          const name = String(order.metadata?.dispensedItemName ?? order.metadata?.medication ?? order.orderNo);
          return qty > 0 ? `${name} × ${qty}` : name;
        });
        const first = lines[0];
        return {
          serviceLine: 'pharmacy' as const,
          serviceEntityId: groupId,
          encounterId: first.encounter?.id ?? null,
          orderNo: first.orderNo,
          description: names.join(' · '),
          dispensedAt: first.completedAt,
        };
      });
  }

  private async nextHospitalReceiptNo() {
    const year = new Date().getFullYear();
    const prefix = `JH-RCP-${year}-`;
    const latest = await this.transactions
      .createQueryBuilder('txn')
      .where('txn.externalReference LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('txn.externalReference', 'DESC')
      .getOne();
    const last = Number(latest?.externalReference?.slice(prefix.length) ?? '0');
    const next = Number.isFinite(last) ? last + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
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

  assertAmount(amount: number | undefined, allowZero: boolean) {
    if (amount == null) {
      throw new BadRequestException('Amount is required');
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Amount cannot be negative');
    }
    if (!allowZero && amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
  }

  private async lockChargeForPayment(
    chargeId: string | undefined,
    patientId: string,
    amount: number,
    waived: boolean,
  ) {
    if (!chargeId || !chargesEnabled()) return null;
    const charge = await this.charges.findOne({
      where: { id: chargeId },
      relations: { patient: true },
    });
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.patient.id !== patientId) {
      throw new BadRequestException('This payment does not belong to the selected patient.');
    }
    if (charge.status === 'cancelled' || charge.status === 'paid') {
      throw new BadRequestException('This charge is already closed.');
    }
    const remaining = chargeRemaining(charge);
    if (!waived && amount > remaining) {
      throw new BadRequestException(
        `Payment KES ${amount} exceeds remaining balance KES ${remaining} on this charge.`,
      );
    }
    return charge;
  }

  private async applyPaymentToCharge(charge: Charge, amount: number, waived: boolean) {
    if (waived) {
      charge.amountWaived = String(Number(charge.amountWaived) + amount);
    } else {
      charge.amountPaid = String(Number(charge.amountPaid) + amount);
    }
    const remaining = chargeRemaining(charge);
    charge.status = remaining <= 0 ? (waived && Number(charge.amountPaid) <= 0 ? 'waived' : 'paid') : 'partially_paid';
    await this.charges.save(charge);
  }

  private async findByIdempotencyKey(key: string) {
    return this.transactions
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.patient', 'patient')
      .where("txn.metadata->>'idempotencyKey' = :key", { key })
      .getOne();
  }

  private async assertNoRecentDuplicate(params: {
    patientId: string;
    amount: number;
    method: string;
    serviceLine: PaymentServiceLine;
  }) {
    const recent = await this.transactions.findOne({
      where: {
        patient: { id: params.patientId },
        method: params.method as PaymentTransaction['method'],
        serviceLine: params.serviceLine,
        amount: String(params.amount),
        createdAt: MoreThan(new Date(Date.now() - 2 * 60 * 1000)),
      },
    });
    if (recent && (recent.status === 'completed' || recent.status === 'initiated')) {
      throw new BadRequestException(
        'A matching payment was just recorded. Refresh the cashier desk instead of submitting again.',
      );
    }
  }

  private async enqueueQuickbooksOnce(
    entityType: QuickbooksSyncQueueItem['entityType'],
    entityId: string,
    action: QuickbooksSyncQueueItem['action'],
    payload: Record<string, unknown>,
  ) {
    const paymentId = typeof payload.paymentId === 'string' ? payload.paymentId : null;
    const existing = await this.qbQueue.find({
      where: { entityType, entityId, action },
      take: 20,
    });
    if (
      existing.some(
        (row) =>
          (paymentId && row.payload?.paymentId === paymentId) ||
          (payload.checkoutRequestId && row.payload?.checkoutRequestId === payload.checkoutRequestId),
      )
    ) {
      return existing[0];
    }
    return this.enqueueQuickbooks(entityType, entityId, action, payload);
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
