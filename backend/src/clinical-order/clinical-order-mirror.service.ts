import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { LabRequest } from '../laboratory/laboratory.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { ClinicalOrder } from './clinical-order.entities';

@Injectable()
export class ClinicalOrderMirrorService {
  constructor(
    @InjectRepository(ClinicalOrder)
    private readonly orders: Repository<ClinicalOrder>,
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
  }, request: RequestContext) {
    const { randomUUID } = await import('crypto');
    return this.orders.save(
      this.orders.create({
        orderNo: input.orderNo,
        patient: { id: input.patientId } as never,
        encounter: input.encounterId ? ({ id: input.encounterId } as never) : null,
        admission: input.admissionId ? ({ id: input.admissionId } as never) : null,
        orderType: 'pharmacy',
        sourceModule: 'pharmacy',
        sourceRecordId: randomUUID(),
        status: input.status,
        priority: input.priority,
        orderedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        orderedAt: new Date(),
        completedAt: null,
        metadata: {
          medication: input.medication,
          dose: input.dose ?? null,
          route: input.route ?? null,
          frequency: input.frequency ?? null,
        },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listOrders(filters: {
    sourceModule?: string
    status?: string
    patientId?: string
    limit?: number
    offset?: number
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.sourceModule) where.sourceModule = filters.sourceModule;
    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patient = { id: filters.patientId };
    return this.orders.find({
      where,
      relations: { patient: true, encounter: true },
      order: { orderedAt: 'DESC' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });
  }

  listByModule(sourceModule: string, status?: string, limit = 50, offset = 0) {
    return this.listOrders({ sourceModule, status, limit, offset });
  }
}
