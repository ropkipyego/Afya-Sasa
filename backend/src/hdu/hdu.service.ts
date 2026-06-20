import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import { HduAdmission, HduObservation, HduRound } from './hdu.entities';
import {
  CreateHduAdmissionDto,
  CreateHduObservationDto,
  CreateHduRoundDto,
  UpdateHduStatusDto,
} from './hdu.dto';

@Injectable()
export class HduService {
  constructor(
    @InjectRepository(HduAdmission)
    private readonly hduAdmissions: Repository<HduAdmission>,
    @InjectRepository(HduObservation)
    private readonly observations: Repository<HduObservation>,
    @InjectRepository(HduRound) private readonly rounds: Repository<HduRound>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(Bed) private readonly beds: Repository<Bed>,
  ) {}

  async admit(dto: CreateHduAdmissionDto, request: RequestContext) {
    const admission = await this.admissions.findOne({ where: { id: dto.admissionId } });
    if (!admission) throw new NotFoundException('Admission not found');
    const bed = dto.hduBedId ? await this.beds.findOne({ where: { id: dto.hduBedId } }) : null;
    return this.hduAdmissions.save(
      this.hduAdmissions.create({
        admission,
        acceptedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        hduBed: bed,
        reason: dto.reason,
        status: 'active',
        dischargedFromHduAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  list(status?: 'active' | 'transferred_out' | 'discharged' | 'died') {
    return this.hduAdmissions.find({
      where: { status },
      relations: { admission: { patient: true }, hduBed: true },
      order: { admittedToHduAt: 'DESC' },
    });
  }

  async observe(id: string, dto: CreateHduObservationDto, request: RequestContext) {
    const hduAdmission = await this.get(id);
    return this.observations.save(
      this.observations.create({
        hduAdmission,
        heartRate: dto.heartRate ?? null,
        respiratoryRate: dto.respiratoryRate ?? null,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        spo2: dto.spo2 ?? null,
        oxygenSupport: dto.oxygenSupport ?? null,
        escalationRequired: dto.escalationRequired ?? false,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async round(id: string, dto: CreateHduRoundDto, request: RequestContext) {
    const hduAdmission = await this.get(id);
    return this.rounds.save(
      this.rounds.create({
        hduAdmission,
        clinician: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        assessment: dto.assessment,
        plan: dto.plan,
        escalationDecision: dto.escalationDecision ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async updateStatus(id: string, dto: UpdateHduStatusDto, request: RequestContext) {
    await this.hduAdmissions.update(id, {
      status: dto.status,
      dischargedFromHduAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.get(id);
  }

  private async get(id: string) {
    const admission = await this.hduAdmissions.findOne({
      where: { id },
      relations: { admission: { patient: true }, hduBed: true },
    });
    if (!admission) throw new NotFoundException('HDU admission not found');
    return admission;
  }
}
