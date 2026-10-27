import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, QueryFailedError, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { LabRequest } from '../laboratory/laboratory.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { InventoryItem } from '../inventory/inventory.entities';
import {
  canActorPrescribeRestrictedItem,
  evaluateFormularyStatus,
  type FormularyPolicyMetadata,
} from '../inventory/formulary-status';
import { ClinicalOrder } from './clinical-order.entities';
import { lineValidationError } from './prescription-quantity';

@Injectable()
export class ClinicalOrderMirrorService {
  constructor(
    @InjectRepository(ClinicalOrder)
    private readonly orders: Repository<ClinicalOrder>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItems: Repository<InventoryItem>,
  ) {}

  async mirrorLabRequest(
    labRequest: LabRequest,
    request: RequestContext,
    metadata?: Record<string, unknown>,
  ) {
    const existing = await this.orders.findOne({
      where: { sourceModule: 'laboratory', sourceRecordId: labRequest.id },
    });
    if (existing) return existing;

    return this.orders.save(
      this.orders.create({
        orderNo: `ORD-${labRequest.requestNo}`,
        patient: labRequest.patient,
        encounter: labRequest.encounter,
        admission: labRequest.admission,
        orderType: 'laboratory',
        sourceModule: 'laboratory',
        sourceRecordId: labRequest.id,
        status: labRequest.status,
        priority: labRequest.priority,
        orderedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        orderedAt: labRequest.createdAt ?? new Date(),
        completedAt: null,
        metadata: metadata ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async mirrorRadiologyRequest(
    radiologyRequest: RadiologyRequest,
    request: RequestContext,
    metadata?: Record<string, unknown>,
  ) {
    const existing = await this.orders.findOne({
      where: { sourceModule: 'radiology', sourceRecordId: radiologyRequest.id },
    });
    if (existing) return existing;

    return this.orders.save(
      this.orders.create({
        orderNo: `ORD-${radiologyRequest.requestNo}`,
        patient: radiologyRequest.patient,
        encounter: radiologyRequest.encounter,
        admission: radiologyRequest.admission,
        orderType: 'radiology',
        sourceModule: 'radiology',
        sourceRecordId: radiologyRequest.id,
        status: radiologyRequest.status,
        priority: radiologyRequest.priority,
        orderedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        orderedAt: radiologyRequest.createdAt ?? new Date(),
        completedAt: null,
        metadata: metadata ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async syncSourceStatus(
    sourceModule: 'laboratory' | 'radiology' | 'pharmacy',
    sourceRecordId: string,
    status: string,
    request?: RequestContext,
  ) {
    const existing = await this.orders.findOne({
      where: { sourceModule, sourceRecordId },
    });
    if (!existing) return null;
    const terminal = ['verified', 'completed', 'cancelled', 'dispensed'].includes(status);
    await this.orders.update(existing.id, {
      status,
      completedAt: terminal ? new Date() : existing.completedAt,
      updatedBy: request?.user?.sub ?? existing.updatedBy,
    });
    return this.orders.findOne({ where: { id: existing.id } });
  }

  async mirrorPharmacyOrder(input: {
    orderNo: string
    patientId: string
    encounterId?: string | null
    admissionId?: string | null
    status: string
    priority: string
    medication: string
    dose?: string
    route?: string
    frequency?: string
    itemId?: string
    quantity?: number
    instructions?: string
  }, request: RequestContext) {
    const id = randomUUID();
    return this.orders.save(
      this.orders.create({
        id,
        orderNo: input.orderNo,
        patient: { id: input.patientId } as never,
        encounter: input.encounterId ? ({ id: input.encounterId } as never) : null,
        admission: input.admissionId ? ({ id: input.admissionId } as never) : null,
        orderType: 'pharmacy',
        sourceModule: 'pharmacy',
        sourceRecordId: id,
        status: input.status,
        priority: input.priority,
        orderedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        orderedAt: new Date(),
        completedAt: null,
        metadata: {
          kind: 'line',
          prescriptionGroupId: id,
          medication: input.medication,
          dose: input.dose ?? null,
          route: input.route ?? null,
          frequency: input.frequency ?? null,
          itemId: input.itemId ?? null,
          quantity: input.quantity ?? null,
          quantityPrescribed: input.quantity ?? null,
          quantityDispensed: 0,
          instructions: input.instructions ?? null,
        },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async createPharmacyPrescription(
    input: {
      patientId: string
      encounterId?: string | null
      admissionId?: string | null
      priority?: string
      clientRequestId?: string
      formularyPolicies?: Record<string, FormularyPolicyMetadata>
      lines: Array<{
        medication: string
        dose?: string
        route?: string
        frequency?: string
        duration?: string
        unitsPerAdmin?: number
        itemId?: string
        quantity: number
        instructions?: string
        strength?: string
        dosageForm?: string
        unit?: string
      }>
    },
    request: RequestContext,
  ) {
    if (!input.lines.length) {
      throw new BadRequestException('Add at least one medication line.');
    }
    if (input.lines.length > 30) {
      throw new BadRequestException('A prescription cannot exceed 30 medication lines.');
    }
    const itemIds = input.lines.map((line) => line.itemId?.trim() ?? '');
    if (itemIds.some((id) => !id)) {
      throw new BadRequestException(
        'Every prescription line must be linked to an exact pharmacy catalogue product. Free-text names cannot be dispensed.',
      );
    }
    let catalogue: InventoryItem[] = [];
    if (typeof (this.inventoryItems as { createQueryBuilder?: unknown }).createQueryBuilder === 'function') {
      catalogue = await this.inventoryItems
        .createQueryBuilder('item')
        .addSelect('item.strength')
        .addSelect('item.dosageForm')
        .where('item.id IN (:...itemIds)', { itemIds })
        .getMany();
    } else {
      catalogue = await this.inventoryItems.find({
        where: { id: In(itemIds) },
      });
    }
    const catalogById = new Map(catalogue.map((item) => [item.id, item]));
    for (const id of itemIds) {
      const found = catalogById.get(id);
      if (!found) {
        throw new BadRequestException(
          'A prescription line uses a catalogue product that is missing or inactive. Select an active hospital formulary medicine.',
        );
      }
      if (found.active === false) {
        throw new BadRequestException(
          `A prescription line uses a catalogue product that is missing or inactive (${found.name || id} is inactive in the hospital formulary).`,
        );
      }
      if (found.category && found.category !== 'pharmaceutical') {
        throw new BadRequestException(
          `${found.name || id} is a ${found.category.replace(/_/g, ' ')} supply item, not a pharmaceutical hospital formulary medicine.`,
        );
      }
      const policy =
        input.formularyPolicies?.[found.sku ?? id] ??
        (found as unknown as { formularyPolicy?: FormularyPolicyMetadata }).formularyPolicy ??
        null;
      const evaluated = evaluateFormularyStatus(
        { category: found.category ?? 'pharmaceutical', active: true },
        policy,
      );
      if (!canActorPrescribeRestrictedItem(evaluated, request.user?.roles, request.user?.permissions)) {
        throw new BadRequestException(
          `${found.name || id} is restricted under hospital formulary policy (${evaluated.restrictionNote || 'authorised prescriber role required'}).`,
        );
      }
    }
    const actorId = request.user?.sub ?? null;
    const clientRequestId = input.clientRequestId?.trim();
    const replayed = clientRequestId
      ? await this.replayPrescription(clientRequestId, input.patientId, actorId)
      : null;
    if (replayed) return replayed;
    for (const line of input.lines) {
      const error = lineValidationError({
        itemId: line.itemId?.trim() ?? '',
        quantity: line.quantity,
        dose: line.dose ?? '',
        frequency: line.frequency ?? '',
        route: line.route ?? '',
      });
      if (error) throw new BadRequestException(error);
    }
    const headerId = randomUUID();
    const stamp = Date.now();
    const headerPayload = this.orders.create({
      id: headerId,
      orderNo: `RX-${stamp}`,
      patient: { id: input.patientId } as never,
      encounter: input.encounterId ? ({ id: input.encounterId } as never) : null,
      admission: input.admissionId ? ({ id: input.admissionId } as never) : null,
      orderType: 'pharmacy',
      sourceModule: 'pharmacy',
      sourceRecordId: headerId,
      status: 'requested',
      priority: input.priority ?? 'routine',
      orderedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
      orderedAt: new Date(),
      completedAt: null,
      metadata: {
        kind: 'prescription',
        prescriptionGroupId: headerId,
        lineCount: input.lines.length,
        medicationSummary: input.lines
          .map((line) => {
            const cat = catalogById.get(line.itemId?.trim() ?? '');
            return `${line.medication?.trim() || cat?.name || 'Medication'} (${line.dose ?? ''}, qty ${line.quantity})`;
          })
          .join(' · '),
        clientRequestId: clientRequestId || null,
      },
      ...(clientRequestId && (await this.hasClientRequestColumn())
        ? { clientRequestId }
        : {}),
      createdBy: request.user?.sub ?? null,
      updatedBy: request.user?.sub ?? null,
    });
    let header;
    try {
      header = await this.orders.save(headerPayload);
    } catch (error) {
      if (clientRequestId && isUniqueViolation(error)) {
        const existing = await this.replayPrescription(clientRequestId, input.patientId, actorId);
        if (existing) return existing;
      }
      throw error;
    }

    const lines = [];
    for (const [index, line] of input.lines.entries()) {
      const id = randomUUID();
      const catalogItem = catalogById.get(line.itemId?.trim() ?? '');
      const policy =
        (catalogItem && input.formularyPolicies?.[catalogItem.sku ?? catalogItem.id]) ??
        (catalogItem as unknown as { formularyPolicy?: FormularyPolicyMetadata } | undefined)?.formularyPolicy ??
        null;
      const formularyEval = evaluateFormularyStatus(
        {
          category: catalogItem?.category ?? 'pharmaceutical',
          active: catalogItem?.active !== false,
        },
        policy,
      );
      lines.push(
        await this.orders.save(
          this.orders.create({
            id,
            orderNo: `RX-${stamp}-${index + 1}`,
            patient: { id: input.patientId } as never,
            encounter: input.encounterId ? ({ id: input.encounterId } as never) : null,
            admission: input.admissionId ? ({ id: input.admissionId } as never) : null,
            orderType: 'pharmacy',
            sourceModule: 'pharmacy',
            sourceRecordId: id,
            status: 'requested',
            priority: input.priority ?? 'routine',
            orderedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
            orderedAt: new Date(),
            completedAt: null,
            metadata: {
              kind: 'line',
              parentOrderId: headerId,
              prescriptionGroupId: headerId,
              lineNo: index + 1,
              medication: line.medication?.trim() || catalogItem?.name || 'Medication',
              sku: catalogItem?.sku ?? null,
              strength: line.strength?.trim() || catalogItem?.strength || null,
              dosageForm: line.dosageForm?.trim() || catalogItem?.dosageForm || catalogItem?.unit || null,
              unit: line.unit?.trim() || catalogItem?.unit || null,
              dose: line.dose ?? null,
              route: line.route ?? null,
              frequency: line.frequency ?? null,
              duration: line.duration ?? null,
              unitsPerAdmin: line.unitsPerAdmin ?? null,
              itemId: catalogItem?.id ?? line.itemId ?? null,
              formularyStatus: formularyEval.formularyStatus,
              prescribingStatus: formularyEval.prescribingStatus,
              regulatoryStatus: formularyEval.regulatoryStatus,
              ppbRegistrationNo: formularyEval.ppbRegistrationNo,
              quantity: line.quantity,
              quantityPrescribed: line.quantity,
              quantityDispensed: 0,
              dispensedQuantity: 0,
              instructions: line.instructions ?? null,
            },
            createdBy: request.user?.sub ?? null,
            updatedBy: request.user?.sub ?? null,
          }),
        ),
      );
    }
    return { header, lines };
  }

  async cancelPharmacyPrescription(orderOrGroupId: string, reason: string | undefined, request: RequestContext) {
    const trimmed = orderOrGroupId.trim();
    if (!trimmed) throw new BadRequestException('Prescription identifier is required.');
    const target = await this.orders.findOne({
      where: { id: trimmed, orderType: 'pharmacy' },
      relations: { patient: true },
    });
    if (!target) {
      throw new BadRequestException('Prescription order was not found.');
    }
    const groupId = String(target.metadata?.prescriptionGroupId ?? target.metadata?.parentOrderId ?? target.id);
    const allInPatient = await this.orders.find({
      where: { orderType: 'pharmacy', patient: { id: target.patient.id } },
    });
    const affected =
      target.metadata?.kind === 'prescription'
        ? allInPatient.filter(
            (row) =>
              row.id === groupId ||
              row.metadata?.prescriptionGroupId === groupId ||
              row.metadata?.parentOrderId === groupId,
          )
        : [target];

    for (const row of affected) {
      const disp = Number(row.metadata?.quantityDispensed ?? row.metadata?.dispensedQuantity ?? 0);
      if (row.status === 'dispensed' || row.status === 'partially_dispensed' || disp > 0) {
        throw new BadRequestException(
          `Order ${row.orderNo} has already been dispensed (${disp} issued) and cannot be erased or cancelled.`,
        );
      }
    }

    const nowIso = new Date().toISOString();
    for (const row of affected) {
      row.status = 'cancelled';
      row.completedAt = new Date();
      row.updatedBy = request.user?.sub ?? null;
      row.metadata = {
        ...(row.metadata ?? {}),
        cancelledAt: nowIso,
        cancelledBy: request.user?.sub ?? null,
        cancelReason: reason?.trim() || 'Cancelled by prescriber',
      };
      await this.orders.save(row);
    }

    return {
      cancelled: affected.length,
      groupId,
      orderIds: affected.map((row) => row.id),
      reason: reason?.trim() || 'Cancelled by prescriber',
    };
  }

  async listOrders(filters: {
    sourceModule?: string
    status?: string
    patientId?: string
    encounterId?: string
    admissionId?: string
    limit?: number
    offset?: number
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.sourceModule) where.sourceModule = filters.sourceModule;
    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patient = { id: filters.patientId };
    if (filters.encounterId) where.encounter = { id: filters.encounterId };
    if (filters.admissionId) where.admission = { id: filters.admissionId };
    const rows = await this.orders.find({
      where,
      relations: {
        patient: true,
        encounter: true,
        admission: { ward: true, bed: true },
        orderedBy: true,
      },
      order: { orderedAt: 'DESC' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });
    return rows.map((row) => ({
      ...row,
      orderedBy: row.orderedBy
        ? {
            id: row.orderedBy.id,
            firstName: row.orderedBy.firstName,
            lastName: row.orderedBy.lastName,
            employeeNo: row.orderedBy.employeeNo,
            specialisation: row.orderedBy.specialisation,
          }
        : null,
    }));
  }

  listByModule(sourceModule: string, status?: string, limit = 50, offset = 0) {
    return this.listOrders({ sourceModule, status, limit, offset });
  }

  private clientRequestColumnReady?: boolean;

  private async hasClientRequestColumn() {
    if (this.clientRequestColumnReady != null) return this.clientRequestColumnReady;
    const rows = (await this.orders.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'demo'
          AND table_name = 'clinical_orders'
          AND column_name = 'client_request_id'`,
    )) as Array<{ column_name: string }>;
    this.clientRequestColumnReady = rows.length === 1;
    return this.clientRequestColumnReady;
  }

  private async replayPrescription(clientRequestId: string, patientId: string, actorId: string | null) {
    let header: ClinicalOrder | null = null;
    if (await this.hasClientRequestColumn()) {
      header =
        (await this.orders
          .createQueryBuilder('order')
          .addSelect('order.clientRequestId')
          .where('order.clientRequestId = :clientRequestId', { clientRequestId })
          .getOne()) ?? null;
    }
    if (!header && actorId) {
      const recent = await this.orders.find({
        where: { sourceModule: 'pharmacy', createdBy: actorId, patient: { id: patientId } },
        order: { orderedAt: 'DESC' },
        take: 40,
      });
      header =
        recent.find(
          (row) =>
            row.metadata?.kind === 'prescription' && row.metadata?.clientRequestId === clientRequestId,
        ) ?? null;
    }
    if (!header) return null;
    const rows = await this.orders.find({
      where: { sourceModule: 'pharmacy', patient: { id: patientId } },
      order: { orderedAt: 'DESC' },
      take: 80,
    });
    return {
      header,
      lines: rows.filter(
        (row) => row.metadata?.prescriptionGroupId === header?.id && row.metadata?.kind === 'line',
      ),
      replayed: true as const,
    };
  }
}

function isUniqueViolation(error: unknown) {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  return code === '23505';
}
