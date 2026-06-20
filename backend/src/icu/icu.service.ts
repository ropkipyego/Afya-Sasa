import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import {
  FluidBalance,
  IcuAdmission,
  IcuObservation,
  IcuRound,
  VentilatorRecord,
} from './icu.entities';
import {
  CreateFluidBalanceDto,
  CreateIcuAdmissionDto,
  CreateIcuObservationDto,
  CreateIcuRoundDto,
  CreateVentilatorRecordDto,
  UpdateIcuStatusDto,
} from './icu.dto';

@Injectable()
export class IcuService {
  constructor(
    @InjectRepository(IcuAdmission)
    private readonly icuAdmissions: Repository<IcuAdmission>,
    @InjectRepository(IcuObservation)
    private readonly observations: Repository<IcuObservation>,
    @InjectRepository(VentilatorRecord)
    private readonly ventilators: Repository<VentilatorRecord>,
    @InjectRepository(FluidBalance)
    private readonly fluidBalance: Repository<FluidBalance>,
    @InjectRepository(IcuRound) private readonly rounds: Repository<IcuRound>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(Bed) private readonly beds: Repository<Bed>,
  ) {}

  async admit(dto: CreateIcuAdmissionDto, request: RequestContext) {
    const admission = await this.admissions.findOne({ where: { id: dto.admissionId } });
    if (!admission) throw new NotFoundException('Admission not found');
    const bed = dto.icuBedId ? await this.beds.findOne({ where: { id: dto.icuBedId } }) : null;
    return this.icuAdmissions.save(
      this.icuAdmissions.create({
        admission,
        acceptedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        icuBed: bed,
        reason: dto.reason,
        severityScore: dto.severityScore ?? null,
        status: 'active',
        dischargedFromIcuAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  list(status?: 'active' | 'transferred_out' | 'discharged' | 'died') {
    return this.icuAdmissions.find({
      where: { status },
      relations: { admission: { patient: true }, icuBed: true },
      order: { admittedToIcuAt: 'DESC' },
    });
  }

  async observe(id: string, dto: CreateIcuObservationDto, request: RequestContext) {
    const icuAdmission = await this.get(id);
    return this.observations.save(
      this.observations.create({
        icuAdmission,
        ...dto,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async ventilator(id: string, dto: CreateVentilatorRecordDto, request: RequestContext) {
    const icuAdmission = await this.get(id);
    return this.ventilators.save(
      this.ventilators.create({
        icuAdmission,
        ...dto,
        fio2: dto.fio2 ?? null,
        peep: dto.peep ?? null,
        tidalVolume: dto.tidalVolume ?? null,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async fluid(id: string, dto: CreateFluidBalanceDto, request: RequestContext) {
    const icuAdmission = await this.get(id);
    const input = dto.inputVolumeMl ?? 0;
    const output = dto.outputVolumeMl ?? 0;
    return this.fluidBalance.save(
      this.fluidBalance.create({
        icuAdmission,
        inputVolumeMl: dto.inputVolumeMl ?? null,
        outputVolumeMl: dto.outputVolumeMl ?? null,
        netBalanceMl: input - output,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async round(id: string, dto: CreateIcuRoundDto, request: RequestContext) {
    const icuAdmission = await this.get(id);
    return this.rounds.save(
      this.rounds.create({
        icuAdmission,
        clinician: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        assessment: dto.assessment,
        plan: dto.plan,
        escalationDecision: dto.escalationDecision ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async updateStatus(id: string, dto: UpdateIcuStatusDto, request: RequestContext) {
    await this.icuAdmissions.update(id, {
      status: dto.status,
      dischargedFromIcuAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.get(id);
  }

  private async get(id: string) {
    const admission = await this.icuAdmissions.findOne({
      where: { id },
      relations: { admission: { patient: true }, icuBed: true },
    });
    if (!admission) throw new NotFoundException('ICU admission not found');
    return admission;
  }
}
