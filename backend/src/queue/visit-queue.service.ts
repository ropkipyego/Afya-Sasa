import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  VisitQueueItem,
  type VisitQueueStatus,
  type VisitQueueType,
} from './visit-queue.entities';

const DEFAULT_PREFIX: Record<VisitQueueType, string> = {
  OPD: 'OPD',
  LAB: 'LAB',
  RAD: 'RAD',
  PHARM: 'PHARM',
  CASH: 'CASH',
  ED: 'ED',
  IPD: 'IPD',
  THEATRE: 'TH',
  MAT: 'MAT',
  ICU: 'ICU',
  HDU: 'HDU',
};

const ACTIVE: VisitQueueStatus[] = ['WAITING', 'CALLED', 'IN_SERVICE'];

@Injectable()
export class VisitQueueService {
  constructor(
    @InjectRepository(VisitQueueItem)
    private readonly items: Repository<VisitQueueItem>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
  ) {}

  async issue(params: {
    patientId: string;
    encounterId?: string | null;
    queueType: VisitQueueType;
    serviceEntityId?: string | null;
    request: RequestContext;
  }) {
    const patient = await this.patients.findOne({ where: { id: params.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const encounter = params.encounterId
      ? await this.encounters.findOne({ where: { id: params.encounterId } })
      : null;
    const tokenDate = nairobiDate();

    const reuse = await this.items.findOne({
      where: {
        patient: { id: patient.id },
        queueType: params.queueType,
        tokenDate,
        status: In(ACTIVE),
        ...(params.encounterId ? { encounter: { id: params.encounterId } } : {}),
      },
      relations: { patient: true, encounter: true },
      order: { createdAt: 'DESC' },
    });
    if (reuse) return reuse;

    return this.items.manager.transaction(async (manager) => {
      const repo = manager.getRepository(VisitQueueItem);
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `visit-queue:${params.queueType}:${tokenDate}`,
      ]);
      const prefix = this.prefixFor(params.queueType);
      const latest = await repo
        .createQueryBuilder('item')
        .where('item.queue_type = :type', { type: params.queueType })
        .andWhere('item.token_date = :date', { date: tokenDate })
        .andWhere('item.deleted_at IS NULL')
        .orderBy('item.token', 'DESC')
        .setLock('pessimistic_write')
        .getOne();
      const next = nextToken(prefix, latest?.token);
      return repo.save(
        repo.create({
          patient,
          encounter,
          queueType: params.queueType,
          token: next,
          tokenDate,
          status: 'WAITING',
          serviceEntityId: params.serviceEntityId ?? null,
          createdBy: params.request.user?.sub ?? null,
          updatedBy: params.request.user?.sub ?? null,
        }),
      );
    });
  }

  list(params: { queueType?: VisitQueueType; date?: string; status?: VisitQueueStatus; patientId?: string }) {
    const tokenDate = params.date || nairobiDate();
    return this.items.find({
      where: {
        ...(params.queueType ? { queueType: params.queueType } : {}),
        ...(params.patientId ? { patient: { id: params.patientId } } : { tokenDate }),
        ...(params.status ? { status: params.status } : {}),
      },
      relations: { patient: true, encounter: true },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async currentForPatient(patientId: string) {
    return this.items.find({
      where: { patient: { id: patientId }, status: In(ACTIVE) },
      relations: { encounter: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async mapForEncounters(encounterIds: string[]) {
    if (!encounterIds.length) return new Map<string, VisitQueueItem>();
    const rows = await this.items.find({
      where: { encounter: { id: In(encounterIds) }, status: In([...ACTIVE, 'COMPLETED', 'TRANSFERRED']) },
      relations: { encounter: true },
      order: { createdAt: 'DESC' },
    });
    const map = new Map<string, VisitQueueItem>();
    for (const row of rows) {
      const encounterId = row.encounter?.id;
      if (encounterId && !map.has(encounterId)) map.set(encounterId, row);
    }
    return map;
  }

  async transition(id: string, status: VisitQueueStatus, request: RequestContext) {
    const item = await this.items.findOne({
      where: { id },
      relations: { patient: true, encounter: true },
    });
    if (!item) throw new NotFoundException('Queue item not found');
    if (item.status === 'COMPLETED' || item.status === 'CANCELLED') {
      throw new BadRequestException('This queue token is already closed.');
    }
    item.status = status;
    item.updatedBy = request.user?.sub ?? null;
    if (status === 'CALLED') item.calledAt = item.calledAt ?? new Date();
    if (status === 'IN_SERVICE') item.startedAt = item.startedAt ?? new Date();
    if (status === 'COMPLETED' || status === 'SKIPPED' || status === 'CANCELLED' || status === 'TRANSFERRED') {
      item.completedAt = new Date();
    }
    return this.items.save(item);
  }

  async transfer(id: string, queueType: VisitQueueType, request: RequestContext) {
    const current = await this.transition(id, 'TRANSFERRED', request);
    return this.issue({
      patientId: current.patient.id,
      encounterId: current.encounter?.id ?? null,
      queueType,
      request,
      serviceEntityId: current.id,
    });
  }

  private prefixFor(type: VisitQueueType) {
    const envKey = `QUEUE_PREFIX_${type}`;
    return process.env[envKey]?.trim() || DEFAULT_PREFIX[type];
  }
}

export function nairobiDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function nextToken(prefix: string, latest?: string | null): string {
  const match = latest?.match(/(\d+)$/);
  const next = (match ? Number(match[1]) : 0) + 1;
  if (!Number.isFinite(next) || next < 1) {
    throw new BadRequestException('Could not allocate the next queue token.');
  }
  return `${prefix}-${String(next).padStart(3, '0')}`;
}
