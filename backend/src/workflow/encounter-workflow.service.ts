import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { LabRequest, LabResult } from '../laboratory/laboratory.entities';
import { Encounter } from '../opd/opd.entities';
import { RadiologyReport, RadiologyRequest } from '../radiology/radiology.entities';

export type EncounterStatus = Encounter['status'];

const ALLOWED_TRANSITIONS: Partial<Record<EncounterStatus, EncounterStatus[]>> = {
  registered: ['triaged'],
  triaged: ['in_consultation', 'awaiting_results', 'completed', 'admitted'],
  in_consultation: ['awaiting_results', 'completed', 'admitted'],
  awaiting_results: ['in_consultation', 'completed', 'admitted'],
  admitted: ['completed'],
};

const CLOSED_LAB_STATUSES: LabRequest['status'][] = ['verified', 'cancelled'];
const CLOSED_RAD_STATUSES: RadiologyRequest['status'][] = ['verified', 'cancelled'];

export type InvestigationOutstanding = {
  openLab: number;
  openRad: number;
  unreviewedLab: number;
  unreviewedRad: number;
  unreviewedCritical: number;
};

@Injectable()
export class EncounterWorkflowService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(LabRequest)
    private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(LabResult)
    private readonly labResults: Repository<LabResult>,
    @InjectRepository(RadiologyRequest)
    private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(RadiologyReport)
    private readonly radiologyReports: Repository<RadiologyReport>,
  ) {}

  allowedTargets(from: EncounterStatus): EncounterStatus[] {
    return [...(ALLOWED_TRANSITIONS[from] ?? [])];
  }

  canTransition(from: EncounterStatus, to: EncounterStatus): boolean {
    const allowed = this.allowedTargets(from);
    return allowed.includes(to) || from === to;
  }

  blockedTransitionMessage(from: EncounterStatus, to: EncounterStatus): string {
    const allowed = this.allowedTargets(from);
    const allowedText = allowed.length ? allowed.join(', ') : 'none';
    return `Cannot move encounter from "${from}" to "${to}". Current status "${from}" blocks this transition. Allowed next statuses: ${allowedText}.`;
  }

  async transition(
    encounterId: string,
    to: EncounterStatus,
    request: RequestContext,
    reason?: string,
  ) {
    const encounter = await this.encounters.findOne({ where: { id: encounterId } });
    if (!encounter) return null;

    if (!this.canTransition(encounter.status, to)) {
      return encounter;
    }

    await this.encounters.update(encounterId, {
      status: to,
      updatedBy: request.user?.sub ?? null,
      ...(reason ? { presentingComplaint: encounter.presentingComplaint } : {}),
    });

    return this.encounters.findOne({ where: { id: encounterId } });
  }

  /** Enforces allowed transitions — throws when the move is invalid. */
  async requireTransition(
    encounterId: string,
    to: EncounterStatus,
    request: RequestContext,
  ) {
    const encounter = await this.encounters.findOne({ where: { id: encounterId } });
    if (!encounter) {
      throw new BadRequestException('Encounter not found');
    }
    if (!this.canTransition(encounter.status, to)) {
      throw new BadRequestException(this.blockedTransitionMessage(encounter.status, to));
    }
    if (to === 'completed' && encounter.type === 'opd') {
      await this.assertCanComplete(encounterId);
    }
    await this.encounters.update(encounterId, {
      status: to,
      endedAt: to === 'completed' ? new Date() : undefined,
      updatedBy: request.user?.sub ?? null,
    });
    return this.encounters.findOne({ where: { id: encounterId } });
  }

  async markAwaitingResults(encounterId: string, request: RequestContext) {
    return this.requireTransition(encounterId, 'awaiting_results', request);
  }

  async investigationOutstanding(encounterId: string): Promise<InvestigationOutstanding> {
    const [openLab, openRad, unreviewedLab, unreviewedRad, unreviewedCritical] = await Promise.all([
      this.labRequests.count({
        where: { encounter: { id: encounterId }, status: Not(In(CLOSED_LAB_STATUSES)) },
      }),
      this.radiologyRequests.count({
        where: { encounter: { id: encounterId }, status: Not(In(CLOSED_RAD_STATUSES)) },
      }),
      this.labResults
        .createQueryBuilder('result')
        .innerJoin('result.requestItem', 'item')
        .innerJoin('item.request', 'request')
        .where('request.encounter_id = :encounterId', { encounterId })
        .andWhere('result.verified_at IS NOT NULL')
        .andWhere('result.reviewed_at IS NULL')
        .getCount(),
      this.radiologyReports
        .createQueryBuilder('report')
        .innerJoin('report.request', 'request')
        .where('request.encounter_id = :encounterId', { encounterId })
        .andWhere('report.verified_at IS NOT NULL')
        .andWhere('report.reviewed_at IS NULL')
        .getCount(),
      this.labResults
        .createQueryBuilder('result')
        .innerJoin('result.requestItem', 'item')
        .innerJoin('item.request', 'request')
        .where('request.encounter_id = :encounterId', { encounterId })
        .andWhere('result.verified_at IS NOT NULL')
        .andWhere('result.reviewed_at IS NULL')
        .andWhere('result.is_critical = true')
        .getCount(),
    ]);

    return { openLab, openRad, unreviewedLab, unreviewedRad, unreviewedCritical };
  }

  async assertCanComplete(encounterId: string) {
    const outstanding = await this.investigationOutstanding(encounterId);
    const unreviewed = outstanding.unreviewedLab + outstanding.unreviewedRad;
    if (!unreviewed) return;
    if (outstanding.unreviewedCritical) {
      throw new BadRequestException(
        `Cannot complete visit: ${outstanding.unreviewedCritical} critical result(s) still need clinician review.`,
      );
    }
    throw new BadRequestException(
      `Cannot complete visit: ${unreviewed} verified result(s) still need clinician review.`,
    );
  }

  /** Return to consultation only when every order is closed and every verified result is reviewed. */
  async maybeReturnToConsultation(encounterId: string, request: RequestContext) {
    const encounter = await this.encounters.findOne({ where: { id: encounterId } });
    if (!encounter || encounter.status !== 'awaiting_results') {
      return encounter;
    }
    const outstanding = await this.investigationOutstanding(encounterId);
    const stillWaiting =
      outstanding.openLab +
        outstanding.openRad +
        outstanding.unreviewedLab +
        outstanding.unreviewedRad >
      0;
    if (stillWaiting) {
      return encounter;
    }
    return this.requireTransition(encounterId, 'in_consultation', request);
  }
}
