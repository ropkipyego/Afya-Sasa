import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { RealtimeService } from '../realtime/realtime.service';
import { PatientAllergy, PatientChronicCondition } from '../patients/patient.entities';
import { Patient } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import {
  CriticalAlert,
  EmergencyEncounter,
  EmergencyNote,
  EmergencyObservationLog,
  EmergencyTreatmentBay,
  EmergencyTriageCategory,
} from './emergency.entities';
import {
  AssignEmergencyBayDto,
  CreateCriticalAlertDto,
  CreateEmergencyEncounterDto,
  CreateEmergencyNoteDto,
  CreateObservationLogDto,
  DispositionDto,
  EmergencyTriageDto,
  UpdateEmergencyWorkflowDto,
} from './emergency.dto';

const TRIAGE_ORDER: Record<EmergencyTriageCategory, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  green: 3,
  black: 4,
};

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientAllergy) private readonly allergies: Repository<PatientAllergy>,
    @InjectRepository(PatientChronicCondition)
    private readonly chronicConditions: Repository<PatientChronicCondition>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(EmergencyEncounter) private readonly emergencies: Repository<EmergencyEncounter>,
    @InjectRepository(EmergencyTreatmentBay) private readonly bays: Repository<EmergencyTreatmentBay>,
    @InjectRepository(EmergencyNote) private readonly notes: Repository<EmergencyNote>,
    @InjectRepository(EmergencyObservationLog)
    private readonly observationLogs: Repository<EmergencyObservationLog>,
    @InjectRepository(CriticalAlert) private readonly alerts: Repository<CriticalAlert>,
    private readonly realtime: RealtimeService,
  ) {}

  async register(dto: CreateEmergencyEncounterDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const encounter = await this.encounters.save(
      this.encounters.create({
        encounterNo: await this.generateEmergencyNo(),
        patient,
        type: 'emergency',
        status: 'registered',
        attendingDoctor: null,
        presentingComplaint: dto.presentingComplaint,
        visitType: null,
        referralSource: null,
        referralReason: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    return this.emergencies.save(
      this.emergencies.create({
        encounter,
        arrivalMode: dto.arrivalMode,
        traumaFlag: dto.traumaFlag ?? false,
        traumaMechanism: dto.traumaMechanism ?? null,
        status: 'active',
        workflowStage: 'arrival',
        triageCategory: null,
        disposition: null,
        outcome: null,
        transferFacility: null,
        dispositionNotes: null,
        resuscitationFlag: dto.resuscitationFlag ?? false,
        resuscitationNotes: dto.resuscitationNotes ?? null,
        chiefComplaint: dto.presentingComplaint,
        assignedClinician: null,
        bay: null,
        observationStartedAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async dashboardMetrics() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = await this.emergencies.find({
      where: { arrivalTime: Between(startOfDay, new Date()) },
      relations: { encounter: { patient: true }, bay: true, assignedClinician: true },
    });
    const active = today.filter((e) => e.status === 'active');
    const critical = active.filter((e) => e.triageCategory === 'red' || e.triageCategory === 'orange');
    const resuscitation = active.filter((e) => e.resuscitationFlag || e.bay?.bayType === 'resuscitation');
    const awaitingDoctor = active.filter((e) =>
      ['triaged', 'treatment'].includes(e.workflowStage),
    );
    const awaitingAdmission = active.filter(
      (e) => e.workflowStage === 'disposition_pending' && e.outcome === 'admitted_ipd',
    );
    const awaitingTransfer = active.filter(
      (e) =>
        e.workflowStage === 'disposition_pending' &&
        ['transferred_icu', 'transferred_hdu', 'transferred_theatre', 'transferred_maternity', 'external_referral'].includes(
          e.outcome ?? '',
        ),
    );
    const awaitingDischarge = active.filter(
      (e) => e.workflowStage === 'disposition_pending' && e.outcome === 'discharged_home',
    );
    const waiting = active.filter((e) => ['arrival', 'triaged'].includes(e.workflowStage));

    return {
      totalToday: today.length,
      waiting: waiting.length,
      critical: critical.length,
      inResuscitation: resuscitation.length,
      awaitingDoctor: awaitingDoctor.length,
      awaitingAdmission: awaitingAdmission.length,
      awaitingTransfer: awaitingTransfer.length,
      awaitingDischarge: awaitingDischarge.length,
      active: active.length,
    };
  }

  async queue() {
    const items = await this.emergencies.find({
      where: { status: 'active' },
      relations: {
        encounter: { patient: true },
        bay: true,
        assignedClinician: true,
      },
      order: { arrivalTime: 'ASC' },
    });
    return items.sort((a, b) => {
      const ta = a.triageCategory ? TRIAGE_ORDER[a.triageCategory] : 99;
      const tb = b.triageCategory ? TRIAGE_ORDER[b.triageCategory] : 99;
      if (ta !== tb) return ta - tb;
      return a.arrivalTime.getTime() - b.arrivalTime.getTime();
    });
  }

  listBays() {
    return this.bays.find({ order: { sortOrder: 'ASC' } });
  }

  async bayBoard() {
    const bays = await this.listBays();
    const active = await this.emergencies.find({
      where: { status: 'active', bay: Not(IsNull()) },
      relations: {
        encounter: { patient: true },
        bay: true,
        assignedClinician: true,
      },
    });
    return bays.map((bay) => {
      const occupant = active.find((e) => e.bay?.id === bay.id) ?? null;
      return {
        ...bay,
        occupant: occupant
          ? {
              emergencyId: occupant.id,
              patientName: `${occupant.encounter.patient.firstName} ${occupant.encounter.patient.lastName}`,
              patientNo: occupant.encounter.patient.patientNo,
              triageCategory: occupant.triageCategory,
              workflowStage: occupant.workflowStage,
              arrivalTime: occupant.arrivalTime,
              clinicianName: occupant.assignedClinician
                ? `${occupant.assignedClinician.firstName} ${occupant.assignedClinician.lastName}`
                : null,
            }
          : null,
      };
    });
  }

  async triage(id: string, dto: EmergencyTriageDto, request: RequestContext) {
    const emergency = await this.getEmergency(id);
    await this.emergencies.update(id, {
      triageCategory: dto.triageCategory,
      workflowStage: 'triaged',
      resuscitationFlag: dto.triageCategory === 'red' ? true : emergency.resuscitationFlag,
      updatedBy: request.user?.sub ?? null,
    });
    if (dto.notes) {
      await this.notes.save(
        this.notes.create({
          emergency,
          noteType: 'nursing',
          body: `Triage (${dto.triageCategory.toUpperCase()}): ${dto.notes}`,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }
    if (dto.triageCategory === 'red' || dto.triageCategory === 'orange') {
      await this.createAlert(
        {
          encounterId: emergency.encounter.id,
          type: 'critical_vitals',
          severity: 'critical',
          message: `${dto.triageCategory.toUpperCase()} triage — immediate clinician attention required.`,
        },
        request,
      );
    }
    return this.workspace(id);
  }

  async assignBay(id: string, dto: AssignEmergencyBayDto, request: RequestContext) {
    const emergency = await this.getEmergency(id);
    const bay = await this.bays.findOne({ where: { id: dto.bayId } });
    if (!bay) throw new NotFoundException('Treatment bay not found');
    await this.emergencies.update(id, {
      bay: { id: bay.id } as never,
      assignedClinician: dto.clinicianId ? ({ id: dto.clinicianId } as never) : emergency.assignedClinician,
      workflowStage: bay.bayType === 'observation' ? 'observation' : 'treatment',
      observationStartedAt: bay.bayType === 'observation' ? new Date() : emergency.observationStartedAt,
      updatedBy: request.user?.sub ?? null,
    });
    await this.bays.update(bay.id, { status: 'occupied', updatedBy: request.user?.sub ?? null });
    return this.workspace(id);
  }

  async updateWorkflow(id: string, dto: UpdateEmergencyWorkflowDto, request: RequestContext) {
    await this.getEmergency(id);
    const patch: Partial<EmergencyEncounter> = {
      workflowStage: dto.workflowStage,
      updatedBy: request.user?.sub ?? null,
    };
    if (dto.workflowStage === 'observation') {
      patch.observationStartedAt = new Date();
    }
    await this.emergencies.update(id, patch);
    return this.workspace(id);
  }

  async addNote(id: string, dto: CreateEmergencyNoteDto, request: RequestContext) {
    const emergency = await this.getEmergency(id);
    return this.notes.save(
      this.notes.create({
        emergency,
        noteType: dto.noteType,
        body: dto.body,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async addObservationLog(id: string, dto: CreateObservationLogDto, request: RequestContext) {
    const emergency = await this.getEmergency(id);
    return this.observationLogs.save(
      this.observationLogs.create({
        emergency,
        vitalsSummary: dto.vitalsSummary ?? null,
        nursingNotes: dto.nursingNotes ?? null,
        doctorReview: dto.doctorReview ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async workspace(id: string) {
    const emergency = await this.emergencies.findOne({
      where: { id },
      relations: {
        encounter: { patient: true, attendingDoctor: true },
        bay: true,
        assignedClinician: true,
      },
    });
    if (!emergency) throw new NotFoundException('Emergency encounter not found');
    const patientId = emergency.encounter.patient.id;
    const [allergies, chronicConditions, notes, observationLogs] = await Promise.all([
      this.allergies.find({ where: { patient: { id: patientId } } }),
      this.chronicConditions.find({ where: { patient: { id: patientId } } }),
      this.notes.find({ where: { emergency: { id } }, order: { createdAt: 'DESC' } }),
      this.observationLogs.find({ where: { emergency: { id } }, order: { recordedAt: 'DESC' } }),
    ]);
    return { ...emergency, allergies, chronicConditions, notes, observationLogs };
  }

  async disposition(id: string, dto: DispositionDto, request: RequestContext) {
    const emergency = await this.emergencies.findOne({
      where: { id },
      relations: { encounter: true, bay: true },
    });
    if (!emergency) throw new NotFoundException('Emergency encounter not found');
    await this.emergencies.update(id, {
      status: 'disposed',
      workflowStage: 'disposed',
      outcome: dto.outcome,
      disposition: dto.outcome,
      transferFacility: dto.transferFacility ?? null,
      dispositionNotes: dto.notes ?? null,
      updatedBy: request.user?.sub ?? null,
    });
    if (emergency.bay) {
      await this.bays.update(emergency.bay.id, {
        status: 'cleaning',
        updatedBy: request.user?.sub ?? null,
      });
    }
    await this.encounters.update(emergency.encounter.id, {
      status: 'completed',
      endedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.emergencies.findOneOrFail({ where: { id } });
  }

  dashboard() {
    return this.queue();
  }

  async createAlert(dto: CreateCriticalAlertDto, request: RequestContext) {
    const encounter = await this.encounters.findOne({ where: { id: dto.encounterId } });
    if (!encounter) throw new NotFoundException('Encounter not found');
    const alert = await this.alerts.save(
      this.alerts.create({
        encounter,
        type: dto.type,
        severity: dto.severity,
        message: dto.message,
        triggeredBy: request.user?.sub ?? null,
        isAuto: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    this.realtime.publish(request.tenant?.code ?? 'demo', 'emergency.alert', {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      encounterId: encounter.id,
    });
    return alert;
  }

  activeAlerts() {
    return this.alerts.find({
      where: { acknowledgedAt: IsNull() },
      relations: { encounter: { patient: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(id: string, request: RequestContext) {
    await this.alerts.update(id, {
      acknowledgedBy: request.user?.sub ?? null,
      acknowledgedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.alerts.findOneOrFail({ where: { id } });
  }

  private async getEmergency(id: string) {
    const emergency = await this.emergencies.findOne({
      where: { id },
      relations: { encounter: true, bay: true },
    });
    if (!emergency) throw new NotFoundException('Emergency encounter not found');
    return emergency;
  }

  private async generateEmergencyNo() {
    const year = new Date().getFullYear();
    const total = await this.encounters.count({ where: { type: 'emergency' } });
    return `ED-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
