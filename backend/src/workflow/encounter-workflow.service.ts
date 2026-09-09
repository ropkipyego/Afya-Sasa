import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';

export type EncounterStatus = Encounter['status'];

const ALLOWED_TRANSITIONS: Partial<Record<EncounterStatus, EncounterStatus[]>> = {
  registered: ['triaged'],
  triaged: ['in_consultation', 'awaiting_results', 'completed', 'admitted'],
  in_consultation: ['awaiting_results', 'completed', 'admitted'],
  awaiting_results: ['in_consultation', 'completed', 'admitted'],
  admitted: ['completed'],
};

@Injectable()
export class EncounterWorkflowService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
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
}
