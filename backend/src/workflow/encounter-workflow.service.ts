import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';

export type EncounterStatus = Encounter['status'];

const ALLOWED_TRANSITIONS: Partial<Record<EncounterStatus, EncounterStatus[]>> = {
  registered: ['triaged', 'completed'],
  triaged: ['in_consultation', 'awaiting_results', 'completed'],
  in_consultation: ['awaiting_results', 'completed', 'admitted'],
  awaiting_results: ['in_consultation', 'completed'],
  admitted: ['completed'],
};

@Injectable()
export class EncounterWorkflowService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
  ) {}

  canTransition(from: EncounterStatus, to: EncounterStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    return allowed.includes(to) || from === to;
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

  async markAwaitingResults(encounterId: string, request: RequestContext) {
    return this.transition(encounterId, 'awaiting_results', request);
  }
}
