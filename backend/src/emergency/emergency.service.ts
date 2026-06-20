import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { CriticalAlert, EmergencyEncounter } from './emergency.entities';
import { CreateCriticalAlertDto, CreateEmergencyEncounterDto, DispositionDto } from './emergency.dto';

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(EmergencyEncounter) private readonly emergencies: Repository<EmergencyEncounter>,
    @InjectRepository(CriticalAlert) private readonly alerts: Repository<CriticalAlert>,
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
        disposition: null,
        transferFacility: null,
        resuscitationFlag: dto.resuscitationFlag ?? false,
        resuscitationNotes: dto.resuscitationNotes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  dashboard() {
    return this.emergencies.find({
      where: { status: 'active' },
      relations: { encounter: { patient: true } },
      order: { arrivalTime: 'ASC' },
    });
  }

  async disposition(id: string, dto: DispositionDto, request: RequestContext) {
    const emergency = await this.emergencies.findOne({
      where: { id },
      relations: { encounter: true },
    });
    if (!emergency) throw new NotFoundException('Emergency encounter not found');
    await this.emergencies.update(id, {
      status: 'disposed',
      disposition: dto.disposition,
      transferFacility: dto.transferFacility ?? null,
      updatedBy: request.user?.sub ?? null,
    });
    await this.encounters.update(emergency.encounter.id, {
      status: 'completed',
      endedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.emergencies.findOneOrFail({ where: { id } });
  }

  async createAlert(dto: CreateCriticalAlertDto, request: RequestContext) {
    const encounter = await this.encounters.findOne({ where: { id: dto.encounterId } });
    if (!encounter) throw new NotFoundException('Encounter not found');
    return this.alerts.save(
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

  private async generateEmergencyNo() {
    const year = new Date().getFullYear();
    const total = await this.encounters.count({ where: { type: 'emergency' } });
    return `ED-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
