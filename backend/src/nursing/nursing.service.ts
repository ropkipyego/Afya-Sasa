import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { User } from '../core/core.entities';
import { Admission, Ward } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import {
  MedicationAdministrationRecord,
  NursingObservation,
  ShiftNote,
  VitalSigns,
} from './nursing.entities';
import {
  CreateMarDto,
  CreateObservationDto,
  CreateShiftNoteDto,
  CreateVitalSignsDto,
  UpdateMarStatusDto,
} from './nursing.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NursingService {
  constructor(
    @InjectRepository(VitalSigns) private readonly vitals: Repository<VitalSigns>,
    @InjectRepository(MedicationAdministrationRecord) private readonly mar: Repository<MedicationAdministrationRecord>,
    @InjectRepository(ShiftNote) private readonly shiftNotes: Repository<ShiftNote>,
    @InjectRepository(NursingObservation) private readonly observations: Repository<NursingObservation>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Ward) private readonly wards: Repository<Ward>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly realtime: RealtimeService,
  ) {}

  async createVitals(dto: CreateVitalSignsDto, request: RequestContext) {
    const encounter = dto.encounterId ? await this.encounters.findOne({ where: { id: dto.encounterId } }) : null;
    const admission = dto.admissionId ? await this.admissions.findOne({ where: { id: dto.admissionId } }) : null;
    if (dto.encounterId && !encounter) throw new NotFoundException('Encounter not found');
    if (dto.admissionId && !admission) throw new NotFoundException('Admission not found');
    const saved = await this.vitals.save(
      this.vitals.create({
        encounter,
        admission,
        temperature: dto.temperature?.toString() ?? null,
        pulse: dto.pulse ?? null,
        respiratoryRate: dto.respiratoryRate ?? null,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        spo2: dto.spo2 ?? null,
        bloodGlucose: dto.bloodGlucose?.toString() ?? null,
        gcs: dto.gcs ?? null,
        weight: null,
        height: null,
        bmi: null,
        urineOutput: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    this.realtime.publish(request.tenant?.code ?? 'demo', 'vitals.recorded', {
      admissionId: dto.admissionId,
      encounterId: dto.encounterId,
      vitalId: saved.id,
    });
    return saved;
  }

  async listVitals(admissionId?: string, encounterId?: string) {
    const where: {
      admission?: { id: string }
      encounter?: { id: string }
    } = {}
    if (admissionId) where.admission = { id: admissionId }
    if (encounterId) where.encounter = { id: encounterId }
    const rows = await this.vitals.find({
      where,
      order: { recordedAt: 'DESC' },
    })

    const userIds = [...new Set(rows.map((row) => row.createdBy).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.users.find({ where: { id: In(userIds) } })
      : [];
    const userMap = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]));

    return rows.map((row) => ({
      ...row,
      recordedByName: row.createdBy ? userMap.get(row.createdBy) ?? 'Clinical staff' : 'Unknown',
    }));
  }

  async createMar(dto: CreateMarDto, request: RequestContext) {
    const admission = await this.admissions.findOne({ where: { id: dto.admissionId } });
    if (!admission) throw new NotFoundException('Admission not found');
    return this.mar.save(
      this.mar.create({
        admission,
        medicationName: dto.medicationName,
        genericName: dto.genericName ?? null,
        dosage: dto.dosage,
        route: dto.route,
        frequency: dto.frequency,
        scheduledTime: new Date(dto.scheduledTime),
        actualTime: null,
        status: 'scheduled',
        withholdReason: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  marForAdmission(admissionId: string) {
    return this.mar.find({
      where: { admission: { id: admissionId } },
      order: { scheduledTime: 'ASC' },
    });
  }

  async updateMarStatus(id: string, dto: UpdateMarStatusDto, request: RequestContext) {
    await this.mar.update(id, {
      status: dto.status,
      actualTime: new Date(),
      withholdReason: dto.withholdReason ?? null,
      updatedBy: request.user?.sub ?? null,
    });
    return this.mar.findOneOrFail({ where: { id } });
  }

  async createShiftNote(dto: CreateShiftNoteDto, request: RequestContext) {
    const ward = await this.wards.findOne({ where: { id: dto.wardId } });
    if (!ward) throw new NotFoundException('Ward not found');
    return this.shiftNotes.save(
      this.shiftNotes.create({
        ward,
        shift: dto.shift,
        date: dto.date,
        type: dto.type,
        body: dto.body,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listShiftNotes(wardId?: string, date?: string) {
    const where: { ward?: { id: string }; date?: string } = {}
    if (wardId) where.ward = { id: wardId }
    if (date) where.date = date
    return this.shiftNotes.find({
      where,
      relations: { ward: true },
      order: { createdAt: 'DESC' },
    })
  }

  async createObservation(dto: CreateObservationDto, request: RequestContext) {
    const admission = await this.admissions.findOne({ where: { id: dto.admissionId } });
    if (!admission) throw new NotFoundException('Admission not found');
    return this.observations.save(
      this.observations.create({
        admission,
        type: dto.type,
        value: dto.value,
        unit: dto.unit ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  observationsForAdmission(admissionId: string) {
    return this.observations.find({
      where: { admission: { id: admissionId } },
      order: { recordedAt: 'DESC' },
    });
  }
}
