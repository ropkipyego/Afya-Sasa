import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  Admission,
  Bed,
  BedTransferLog,
  DailyProgressNote,
  DischargeSummary,
  Ward,
} from './inpatient.entities';
import {
  CreateAdmissionDto,
  CreateBedDto,
  CreateDischargeSummaryDto,
  CreateProgressNoteDto,
  CreateWardDto,
  DischargeAdmissionDto,
  TransferBedDto,
  UpdateBedStatusDto,
  UpdateWardDto,
} from './inpatient.dto';

@Injectable()
export class InpatientService {
  constructor(
    @InjectRepository(Ward) private readonly wards: Repository<Ward>,
    @InjectRepository(Bed) private readonly beds: Repository<Bed>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(BedTransferLog) private readonly transfers: Repository<BedTransferLog>,
    @InjectRepository(DailyProgressNote) private readonly notes: Repository<DailyProgressNote>,
    @InjectRepository(DischargeSummary) private readonly summaries: Repository<DischargeSummary>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
  ) {}

  createWard(dto: CreateWardDto, request: RequestContext) {
    return this.wards.save(
      this.wards.create({
        ...dto,
        floor: dto.floor ?? null,
        active: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listWards() {
    return this.wards.find({ order: { name: 'ASC' } });
  }

  async updateWard(id: string, dto: UpdateWardDto, request: RequestContext) {
    await this.wards.update(id, { ...dto, updatedBy: request.user?.sub ?? null });
    return this.wards.findOneOrFail({ where: { id } });
  }

  async createBed(dto: CreateBedDto, request: RequestContext) {
    const ward = await this.wards.findOne({ where: { id: dto.wardId } });
    if (!ward) throw new NotFoundException('Ward not found');
    const bed = await this.beds.save(
      this.beds.create({
        ward,
        bedNo: dto.bedNo,
        type: dto.type,
        status: 'available',
        version: 1,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.wards.update(ward.id, { bedCount: ward.bedCount + 1 });
    return bed;
  }

  listBeds(wardId?: string) {
    return this.beds.find({
      where: { ward: wardId ? { id: wardId } : undefined },
      relations: { ward: true },
      order: { bedNo: 'ASC' },
    });
  }

  availableBeds() {
    return this.beds.find({
      where: { status: 'available' },
      relations: { ward: true },
      order: { bedNo: 'ASC' },
    });
  }

  async updateBedStatus(id: string, dto: UpdateBedStatusDto, request: RequestContext) {
    const bed = await this.getBed(id);
    await this.beds.update(id, {
      status: dto.status,
      version: bed.version + 1,
      updatedBy: request.user?.sub ?? null,
    });
    return this.getBed(id);
  }

  async createAdmission(dto: CreateAdmissionDto, request: RequestContext) {
    const [patient, bed, encounter] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.getBed(dto.bedId),
      dto.encounterId ? this.encounters.findOne({ where: { id: dto.encounterId } }) : null,
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (bed.status !== 'available') throw new BadRequestException('Bed is not available');
    const admission = await this.admissions.save(
      this.admissions.create({
        admissionNo: await this.generateAdmissionNo(),
        patient,
        encounter,
        bed,
        ward: bed.ward,
        admittingDoctor: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        reason: dto.reason,
        type: dto.type,
        status: 'active',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.beds.update(bed.id, {
      status: 'occupied',
      version: bed.version + 1,
      updatedBy: request.user?.sub ?? null,
    });
    if (encounter) {
      await this.encounters.update(encounter.id, { status: 'admitted' });
    }
    return admission;
  }

  listAdmissions(status?: 'active' | 'discharged', wardId?: string) {
    return this.admissions.find({
      where: {
        status,
        ward: wardId ? { id: wardId } : undefined,
      },
      relations: { patient: true, bed: true, ward: true },
      order: { admittedAt: 'DESC' },
    });
  }

  async transferBed(id: string, dto: TransferBedDto, request: RequestContext) {
    const admission = await this.getAdmission(id);
    const toBed = await this.getBed(dto.toBedId);
    if (toBed.status !== 'available') throw new BadRequestException('Destination bed is not available');
    await this.transfers.save(
      this.transfers.create({
        admission,
        fromBed: admission.bed,
        toBed,
        reason: dto.reason,
        authorisedBy: request.user?.sub ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.beds.update(admission.bed.id, { status: 'available', version: admission.bed.version + 1 });
    await this.beds.update(toBed.id, { status: 'occupied', version: toBed.version + 1 });
    await this.admissions.update(admission.id, {
      bed: toBed,
      ward: toBed.ward,
      updatedBy: request.user?.sub ?? null,
    });
    return this.getAdmission(id);
  }

  async addProgressNote(id: string, dto: CreateProgressNoteDto, request: RequestContext) {
    const admission = await this.getAdmission(id);
    return this.notes.save(
      this.notes.create({
        admission,
        ...dto,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async createDischargeSummary(id: string, dto: CreateDischargeSummaryDto, request: RequestContext) {
    const admission = await this.getAdmission(id);
    return this.summaries.save(
      this.summaries.create({
        admission,
        ...dto,
        diet: dto.diet ?? null,
        status: 'draft',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async completeDischargeSummary(summaryId: string, request: RequestContext) {
    await this.summaries.update(summaryId, {
      status: 'complete',
      finalisedBy: request.user?.sub ?? null,
      finalisedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.summaries.findOneOrFail({ where: { id: summaryId } });
  }

  async dischargeAdmission(id: string, dto: DischargeAdmissionDto, request: RequestContext) {
    const admission = await this.getAdmission(id);
    const summary = await this.summaries.findOne({
      where: { admission: { id }, status: 'complete' },
    });
    if (!summary) throw new BadRequestException('Completed discharge summary is required');
    const lengthOfStayDays = Math.max(
      1,
      Math.ceil((Date.now() - admission.admittedAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    await this.admissions.update(id, {
      status: 'discharged',
      dischargedAt: new Date(),
      dischargingDoctor: request.user?.sub ? ({ id: request.user.sub } as never) : null,
      conditionOnDischarge: dto.conditionOnDischarge,
      lengthOfStayDays,
      updatedBy: request.user?.sub ?? null,
    });
    await this.beds.update(admission.bed.id, {
      status: 'cleaning',
      version: admission.bed.version + 1,
      updatedBy: request.user?.sub ?? null,
    });
    return this.getAdmission(id);
  }

  async bedDashboard() {
    const beds = await this.beds.find({ relations: { ward: true }, order: { bedNo: 'ASC' } });
    const activeAdmissions = await this.admissions.find({
      where: { status: 'active' },
      relations: { patient: true, bed: true },
    });
    return beds.map((bed) => ({
      ...bed,
      patient: activeAdmissions.find((admission) => admission.bed.id === bed.id)?.patient ?? null,
    }));
  }

  private async getBed(id: string) {
    const bed = await this.beds.findOne({ where: { id }, relations: { ward: true } });
    if (!bed) throw new NotFoundException('Bed not found');
    return bed;
  }

  private async getAdmission(id: string) {
    const admission = await this.admissions.findOne({
      where: { id },
      relations: { patient: true, bed: true, ward: true },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    return admission;
  }

  private async generateAdmissionNo() {
    const year = new Date().getFullYear();
    const total = await this.admissions.count();
    return `ADM-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
