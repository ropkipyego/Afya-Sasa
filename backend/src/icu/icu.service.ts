import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { assertCriticalCareBed, assertCriticalCareChartOpen } from './critical-care-gates';

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
    if (admission.status !== 'active') {
      throw new BadRequestException('ICU admission requires an active IPD admission.');
    }
    const duplicate = await this.icuAdmissions.findOne({
      where: { admission: { id: admission.id }, status: 'active' },
    });
    if (duplicate) {
      return duplicate;
    }
    const bed = dto.icuBedId
      ? await this.beds.findOne({ where: { id: dto.icuBedId }, relations: { ward: true } })
      : null;
    if (dto.icuBedId && !bed) throw new NotFoundException('ICU bed not found');
    assertCriticalCareBed(bed, 'icu');
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
      where: status ? { status } : {},
      relations: { admission: { patient: true, ward: true, bed: true }, icuBed: true, acceptedBy: true },
      order: { admittedToIcuAt: 'DESC' },
    });
  }

  async workspace(id: string) {
    const icuAdmission = await this.get(id);
    const [observations, ventilatorRecords, fluidRecords, rounds] = await Promise.all([
      this.observations.find({
        where: { icuAdmission: { id } },
        order: { recordedAt: 'DESC' },
        take: 50,
      }),
      this.ventilators.find({
        where: { icuAdmission: { id } },
        order: { recordedAt: 'DESC' },
        take: 30,
      }),
      this.fluidBalance.find({
        where: { icuAdmission: { id } },
        order: { recordedAt: 'DESC' },
        take: 30,
      }),
      this.rounds.find({
        where: { icuAdmission: { id } },
        relations: { clinician: true },
        order: { roundTime: 'DESC' },
        take: 30,
      }),
    ]);
    return { ...icuAdmission, observations, ventilatorRecords, fluidRecords, rounds };
  }

  async observe(id: string, dto: CreateIcuObservationDto, request: RequestContext) {
    const icuAdmission = await this.get(id);
    assertCriticalCareChartOpen(icuAdmission.status, 'ICU');
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
    assertCriticalCareChartOpen(icuAdmission.status, 'ICU');
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
    assertCriticalCareChartOpen(icuAdmission.status, 'ICU');
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
    assertCriticalCareChartOpen(icuAdmission.status, 'ICU');
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
      relations: { admission: { patient: true, ward: true, bed: true }, icuBed: true, acceptedBy: true },
    });
    if (!admission) throw new NotFoundException('ICU admission not found');
    return admission;
  }
}
