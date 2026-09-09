import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { formatHospitalNumber } from '../common/hospital-numbering';
import { tenantChannel } from '../common/tenant-defaults';
import { formatClinicianName } from '../common/clinician.util';
import { LabRequest } from '../laboratory/laboratory.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
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
import { RealtimeService } from '../realtime/realtime.service';
import { EncounterWorkflowService } from '../workflow/encounter-workflow.service';

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
    @InjectRepository(LabRequest) private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(RadiologyRequest)
    private readonly radiologyRequests: Repository<RadiologyRequest>,
    private readonly realtime: RealtimeService,
    private readonly encounterWorkflow: EncounterWorkflowService,
    private readonly dataSource: DataSource,
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
    const where: { ward?: { id: string } } = {}
    if (wardId) where.ward = { id: wardId }
    return this.beds.find({
      where,
      relations: { ward: true },
      order: { bedNo: 'ASC' },
    })
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
    if (dto.status === 'occupied') {
      throw new BadRequestException(
        'Occupy a bed by admitting or transferring a patient, not by changing bed status.',
      );
    }
    const activeAdmission = await this.admissions.findOne({
      where: { bed: { id }, status: 'active' },
    });
    if (bed.status === 'occupied' && activeAdmission) {
      throw new BadRequestException(
        'Cannot change an occupied bed while an active admission exists. Discharge or transfer the patient first.',
      );
    }
    const userId = request.user?.sub ?? null;
    const updated = await this.beds.update(
      { id, status: bed.status },
      {
        status: dto.status,
        version: bed.version + 1,
        updatedBy: userId,
      },
    );
    if (!updated.affected) {
      throw new BadRequestException('Bed status changed. Refresh and try again.');
    }
    this.realtime.publish(tenantChannel(request), 'bed.updated', {
      bedId: id,
      status: dto.status,
    });
    return this.getBed(id);
  }

  async deleteBed(id: string, request: RequestContext) {
    const bed = await this.getBed(id);
    if (bed.status === 'occupied') {
      throw new BadRequestException('Cannot remove an occupied bed. Discharge or transfer the patient first.');
    }
    const activeAdmission = await this.admissions.findOne({
      where: { bed: { id }, status: 'active' },
    });
    if (activeAdmission) {
      throw new BadRequestException('Cannot remove a bed with an active admission.');
    }
    await this.beds.softRemove(bed);
    const ward = await this.wards.findOne({ where: { id: bed.ward.id } });
    if (ward && ward.bedCount > 0) {
      await this.wards.update(ward.id, {
        bedCount: ward.bedCount - 1,
        updatedBy: request.user?.sub ?? null,
      });
    }
    this.realtime.publish(tenantChannel(request), 'bed.updated', { bedId: id, action: 'deleted' });
    return { ok: true };
  }

  async deleteWard(id: string, request: RequestContext) {
    const ward = await this.wards.findOne({ where: { id } });
    if (!ward) throw new NotFoundException('Ward not found');
    const beds = await this.beds.find({ where: { ward: { id } } });
    const occupied = beds.filter((bed) => bed.status === 'occupied');
    if (occupied.length) {
      throw new BadRequestException('Cannot remove a ward while beds are occupied.');
    }
    if (beds.length) {
      await this.beds.softRemove(beds);
    }
    await this.wards.softRemove(ward);
    this.realtime.publish(tenantChannel(request), 'bed.updated', { wardId: id, action: 'ward_deleted' });
    return { ok: true };
  }

  async createAdmission(dto: CreateAdmissionDto, request: RequestContext) {
    const [patient, bed, encounter] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.getBed(dto.bedId),
      dto.encounterId
        ? this.encounters.findOne({
            where: { id: dto.encounterId },
            relations: { patient: true },
          })
        : Promise.resolve(null),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (dto.encounterId && !encounter) throw new NotFoundException('Encounter not found');
    if (encounter && encounter.patient?.id !== patient.id) {
      throw new BadRequestException('Encounter does not belong to this patient');
    }
    if (bed.status !== 'available') {
      throw new BadRequestException(
        `Bed is not available (current status: ${bed.status}). Choose an available bed.`,
      );
    }
    if (encounter && !this.encounterWorkflow.canTransition(encounter.status, 'admitted')) {
      throw new BadRequestException(
        this.encounterWorkflow.blockedTransitionMessage(encounter.status, 'admitted'),
      );
    }
    const existingForPatient = await this.admissions.findOne({
      where: { patient: { id: patient.id }, status: 'active' },
      relations: { encounter: true },
    });
    if (existingForPatient) {
      throw new BadRequestException('This patient already has an active IPD admission.');
    }
    if (encounter) {
      const existingForEncounter = await this.admissions.findOne({
        where: { encounter: { id: encounter.id }, status: 'active' },
      });
      if (existingForEncounter) {
        throw new BadRequestException('This encounter already has an active IPD admission.');
      }
    }

    const userId = request.user?.sub ?? null;
    const admissionNo = await this.generateAdmissionNo();
    const admissionId = await this.dataSource.transaction(async (manager) => {
      const bedRepo = manager.getRepository(Bed);
      const admissionRepo = manager.getRepository(Admission);
      const encounterRepo = manager.getRepository(Encounter);
      const occupied = await bedRepo.update(
        { id: bed.id, status: 'available' },
        {
          status: 'occupied',
          version: bed.version + 1,
          updatedBy: userId,
        },
      );
      if (!occupied.affected) {
        throw new BadRequestException(
          'Bed is no longer available. Refresh the bed list and try again.',
        );
      }
      if (encounter) {
        const fresh = await encounterRepo.findOne({ where: { id: encounter.id } });
        if (!fresh) throw new NotFoundException('Encounter not found');
        if (!this.encounterWorkflow.canTransition(fresh.status, 'admitted')) {
          throw new BadRequestException(
            this.encounterWorkflow.blockedTransitionMessage(fresh.status, 'admitted'),
          );
        }
        await encounterRepo.update(encounter.id, {
          status: 'admitted',
          updatedBy: userId,
        });
      }
      const admission = await admissionRepo.save(
        admissionRepo.create({
          admissionNo,
          patient,
          encounter,
          bed,
          ward: bed.ward,
          admittingDoctor: userId ? ({ id: userId } as never) : null,
          reason: dto.reason,
          type: dto.type,
          status: 'active',
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      return admission.id;
    });

    this.realtime.publish(tenantChannel(request), 'admission.created', {
      admissionId,
      patientId: patient.id,
      bedId: bed.id,
    });
    return this.admissions.findOneOrFail({
      where: { id: admissionId },
      relations: { patient: true, bed: true, ward: true, admittingDoctor: true, encounter: true },
    });
  }

  findActiveAdmissionForPatient(patientId: string) {
    return this.admissions.findOne({
      where: { patient: { id: patientId }, status: 'active' },
      relations: { encounter: true, patient: true, bed: true, ward: true },
    });
  }

  findActiveAdmissionForEncounter(encounterId: string) {
    return this.admissions.findOne({
      where: { encounter: { id: encounterId }, status: 'active' },
      relations: { encounter: true, patient: true, bed: true, ward: true },
    });
  }

  listAdmissions(status?: 'active' | 'discharged', wardId?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (wardId) where.ward = { id: wardId };
    return this.admissions.find({
      where,
      relations: { patient: true, bed: true, ward: true },
      order: { admittedAt: 'DESC' },
      take: 500,
    });
  }

  async transferBed(id: string, dto: TransferBedDto, request: RequestContext) {
    const admission = await this.getAdmission(id);
    const toBed = await this.getBed(dto.toBedId);
    if (toBed.id === admission.bed.id) {
      throw new BadRequestException('Destination bed is the current bed');
    }
    if (toBed.status !== 'available') {
      throw new BadRequestException(
        `Destination bed is not available (current status: ${toBed.status}). Cleaning, reserved, occupied, and maintenance beds cannot be selected.`,
      );
    }
    const userId = request.user?.sub ?? null;
    await this.dataSource.transaction(async (manager) => {
      const bedRepo = manager.getRepository(Bed);
      const admissionRepo = manager.getRepository(Admission);
      const transferRepo = manager.getRepository(BedTransferLog);
      const occupied = await bedRepo.update(
        { id: toBed.id, status: 'available' },
        {
          status: 'occupied',
          version: toBed.version + 1,
          updatedBy: userId,
        },
      );
      if (!occupied.affected) {
        throw new BadRequestException(
          'Destination bed is no longer available. Refresh the bed list and try again.',
        );
      }
      const released = await bedRepo.update(
        { id: admission.bed.id, status: 'occupied' },
        {
          status: 'available',
          version: admission.bed.version + 1,
          updatedBy: userId,
        },
      );
      if (!released.affected) {
        throw new BadRequestException(
          'Could not release the current bed. Transfer cancelled so housekeeping state is preserved.',
        );
      }
      await admissionRepo.update(admission.id, {
        bed: { id: toBed.id },
        ward: { id: toBed.ward.id },
        updatedBy: userId,
      });
      await transferRepo.save(
        transferRepo.create({
          admission,
          fromBed: admission.bed,
          toBed,
          reason: dto.reason,
          authorisedBy: userId,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
    });
    this.realtime.publish(tenantChannel(request), 'admission.updated', {
      admissionId: id,
      fromBedId: admission.bed.id,
      toBedId: toBed.id,
    });
    this.realtime.publish(tenantChannel(request), 'bed.updated', {
      bedId: toBed.id,
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
    if (admission.status === 'discharged') {
      throw new BadRequestException('Cannot add a discharge summary to a discharged admission.');
    }
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
    const summary = await this.summaries.findOne({
      where: { id: summaryId },
      relations: { admission: true },
    });
    if (!summary) throw new NotFoundException('Discharge summary not found');
    if (summary.admission?.status === 'discharged') {
      throw new BadRequestException('Cannot finalise a summary on a discharged admission.');
    }
    if (summary.status === 'complete') {
      return summary;
    }
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
    if (admission.status === 'discharged') {
      throw new BadRequestException('Admission is already discharged');
    }
    const summary = await this.summaries.findOne({
      where: { admission: { id }, status: 'complete' },
    });
    if (!summary) throw new BadRequestException('Completed discharge summary is required');
    if (admission.encounter?.id) {
      const encounter = await this.encounters.findOne({ where: { id: admission.encounter.id } });
      if (encounter && !this.encounterWorkflow.canTransition(encounter.status, 'completed')) {
        throw new BadRequestException(
          this.encounterWorkflow.blockedTransitionMessage(encounter.status, 'completed'),
        );
      }
    }
    const lengthOfStayDays = Math.max(
      1,
      Math.ceil((Date.now() - admission.admittedAt.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const userId = request.user?.sub ?? null;
    await this.dataSource.transaction(async (manager) => {
      const admissionRepo = manager.getRepository(Admission);
      const bedRepo = manager.getRepository(Bed);
      const encounterRepo = manager.getRepository(Encounter);
      await admissionRepo.update(id, {
        status: 'discharged',
        dischargedAt: new Date(),
        dischargingDoctor: userId ? ({ id: userId } as never) : null,
        conditionOnDischarge: dto.conditionOnDischarge,
        lengthOfStayDays,
        updatedBy: userId,
      });
      await bedRepo.update(
        { id: admission.bed.id, status: 'occupied' },
        {
          status: 'cleaning',
          version: admission.bed.version + 1,
          updatedBy: userId,
        },
      );
      if (admission.encounter?.id) {
        const fresh = await encounterRepo.findOne({ where: { id: admission.encounter.id } });
        if (fresh && this.encounterWorkflow.canTransition(fresh.status, 'completed')) {
          await encounterRepo.update(fresh.id, {
            status: 'completed',
            endedAt: new Date(),
            updatedBy: userId,
          });
        } else if (fresh) {
          throw new BadRequestException(
            this.encounterWorkflow.blockedTransitionMessage(fresh.status, 'completed'),
          );
        }
      }
    });
    this.realtime.publish(tenantChannel(request), 'admission.discharged', {
      admissionId: id,
    });
    this.realtime.publish(tenantChannel(request), 'bed.updated', {
      bedId: admission.bed.id,
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

  async getDashboard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [wards, beds, activeAdmissions, admissionsToday, dischargesToday, transfersToday, pendingLabs, pendingRadiology] =
      await Promise.all([
        this.wards.find({ where: { active: true }, order: { name: 'ASC' } }),
        this.beds.find({ relations: { ward: true } }),
        this.admissions.find({
          where: { status: 'active' },
          relations: { patient: true, bed: true, ward: true },
        }),
        this.admissions.find({
          where: { admittedAt: MoreThanOrEqual(startOfDay) },
        }),
        this.admissions.find({
          where: {
            status: 'discharged',
            dischargedAt: MoreThanOrEqual(startOfDay),
          },
        }),
        this.transfers.find({
          where: { createdAt: MoreThanOrEqual(startOfDay) },
        }),
        this.labRequests.count({
          where: { status: In(['requested', 'sample_collected', 'processing']) },
        }),
        this.radiologyRequests.count({
          where: { status: In(['requested', 'scheduled', 'in_progress']) },
        }),
      ]);

    const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;
    const availableBeds = beds.filter((b) => b.status === 'available').length;

    const wardSummaries = wards.map((ward) => {
      const wardBeds = beds.filter((b) => b.ward.id === ward.id);
      const wardAdmissions = activeAdmissions.filter((a) => a.ward.id === ward.id);
      const capacity = wardBeds.length || ward.bedCount;
      const occupied = wardBeds.filter((b) => b.status === 'occupied').length;
      return {
        id: ward.id,
        name: ward.name,
        code: ward.code,
        type: ward.type,
        capacity,
        occupied,
        available: Math.max(capacity - occupied, 0),
        // No stored IPD acuity exists. Do not invent a clinical "critical" definition.
        criticalPatients: null,
        dueForReview: wardAdmissions.filter((a) => {
          const days = Math.ceil(
            (Date.now() - a.admittedAt.getTime()) / (24 * 60 * 60 * 1000),
          );
          return days >= 1;
        }).length,
      };
    });

    const icuBeds = beds.filter((b) => b.ward.type === 'icu');
    const hduBeds = beds.filter((b) => b.ward.type === 'hdu');
    const icuOccupied = icuBeds.filter((b) => b.status === 'occupied').length;
    const hduOccupied = hduBeds.filter((b) => b.status === 'occupied').length;

    return {
      admissionsToday: admissionsToday.length,
      dischargesToday: dischargesToday.length,
      transfersToday: transfersToday.length,
      occupiedBeds,
      availableBeds,
      totalBeds: beds.length,
      icuOccupancyPct: icuBeds.length
        ? Math.round((icuOccupied / icuBeds.length) * 100)
        : 0,
      hduOccupancyPct: hduBeds.length
        ? Math.round((hduOccupied / hduBeds.length) * 100)
        : 0,
      pendingLabResults: pendingLabs,
      pendingRadiologyReports: pendingRadiology,
      patientsDueForReview: activeAdmissions.filter((a) => {
        const days = Math.ceil(
          (Date.now() - a.admittedAt.getTime()) / (24 * 60 * 60 * 1000),
        );
        return days >= 1;
      }).length,
      wardSummaries,
      activeAdmissions: activeAdmissions.length,
    };
  }

  async getWardCensus(wardId: string) {
    const ward = await this.wards.findOne({ where: { id: wardId } });
    if (!ward) throw new NotFoundException('Ward not found');

    const [beds, activeAdmissions, progressNotes] = await Promise.all([
      this.beds.find({
        where: { ward: { id: wardId } },
        relations: { ward: true },
        order: { bedNo: 'ASC' },
      }),
      this.admissions.find({
        where: { status: 'active', ward: { id: wardId } },
        relations: {
          patient: { allergies: true, chronicConditions: true },
          bed: true,
          ward: true,
          admittingDoctor: true,
        },
      }),
      this.notes.find({
        where: { admission: { ward: { id: wardId }, status: 'active' } },
        relations: { admission: true },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
    ]);

    const census = beds.map((bed) => {
      const admission = activeAdmissions.find((a) => a.bed.id === bed.id) ?? null;
      let clinicalStatus: 'stable' | 'review_due' | 'pending_investigation' | 'critical' | 'discharge_planned' | 'available' =
        bed.status === 'available' ? 'available' : 'stable';

      if (admission) {
        const losDays = Math.ceil(
          (Date.now() - admission.admittedAt.getTime()) / (24 * 60 * 60 * 1000),
        );
        const hasNoteToday = progressNotes.some(
          (n) =>
            n.admission.id === admission.id &&
            n.createdAt >= new Date(new Date().setHours(0, 0, 0, 0)),
        );
        if (!hasNoteToday && losDays >= 1) clinicalStatus = 'review_due';
        if ((admission.patient.allergies?.length ?? 0) > 0 && losDays <= 1) {
          clinicalStatus = 'stable';
        }
      }

      return {
        bed,
        admission,
        patient: admission?.patient ?? null,
        clinicalStatus,
        consultant: formatClinicianName(admission?.admittingDoctor),
      };
    });

    const occupied = beds.filter((b) => b.status === 'occupied').length;
    return {
      ward,
      capacity: beds.length || ward.bedCount,
      occupied,
      available: beds.filter((b) => b.status === 'available').length,
      census,
    };
  }

  async getAdmissionWorkspace(id: string) {
    const admission = await this.admissions.findOne({
      where: { id },
      relations: {
        patient: { allergies: true, chronicConditions: true, identifiers: true, nextOfKin: true },
        bed: true,
        ward: true,
        admittingDoctor: true,
        encounter: true,
      },
    });
    if (!admission) throw new NotFoundException('Admission not found');

    const [progressNotes, transfers, dischargeSummaries] = await Promise.all([
      this.notes.find({
        where: { admission: { id } },
        order: { createdAt: 'DESC' },
      }),
      this.transfers.find({
        where: { admission: { id } },
        relations: { fromBed: { ward: true }, toBed: { ward: true } },
        order: { createdAt: 'ASC' },
      }),
      this.summaries.find({
        where: { admission: { id } },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const losDays = Math.max(
      1,
      Math.ceil((Date.now() - admission.admittedAt.getTime()) / (24 * 60 * 60 * 1000)),
    );

    return {
      admission,
      progressNotes,
      transfers,
      dischargeSummaries,
      lengthOfStayDays: losDays,
    };
  }

  private async getBed(id: string) {
    const bed = await this.beds.findOne({ where: { id }, relations: { ward: true } });
    if (!bed) throw new NotFoundException('Bed not found');
    return bed;
  }

  private async getAdmission(id: string) {
    const admission = await this.admissions.findOne({
      where: { id },
      relations: { patient: true, bed: true, ward: true, encounter: true },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    return admission;
  }

  private async generateAdmissionNo() {
    const total = await this.admissions.count();
    return formatHospitalNumber('adm', total + 1);
  }
}
