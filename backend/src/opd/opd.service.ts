import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Patient } from '../patients/patient.entities';
import {
  ClinicalNote,
  Consultation,
  Encounter,
  EncounterAttachment,
  EncounterDiagnosis,
  OpdEncounterStatus,
  TriageAssessment,
} from './opd.entities';
import {
  CreateAttachmentDto,
  CreateClinicalNoteDto,
  CreateConsultationDto,
  CreateDiagnosisDto,
  CreateEncounterDto,
  CreateTriageDto,
  UpdateConsultationDto,
} from './opd.dto';

const TRIAGE_PRIORITY: Record<string, number> = {
  red: 1,
  orange: 2,
  yellow: 3,
  green: 4,
  blue: 5,
};

@Injectable()
export class OpdService {
  constructor(
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(TriageAssessment)
    private readonly triages: Repository<TriageAssessment>,
    @InjectRepository(Consultation)
    private readonly consultations: Repository<Consultation>,
    @InjectRepository(EncounterDiagnosis)
    private readonly diagnoses: Repository<EncounterDiagnosis>,
    @InjectRepository(ClinicalNote)
    private readonly notes: Repository<ClinicalNote>,
    @InjectRepository(EncounterAttachment)
    private readonly attachments: Repository<EncounterAttachment>,
  ) {}

  async createEncounter(dto: CreateEncounterDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    const encounter = this.encounters.create({
      encounterNo: await this.generateEncounterNo(),
      patient,
      type: 'opd',
      status: 'registered',
      attendingDoctor: null,
      presentingComplaint: dto.presentingComplaint,
      visitType: dto.visitType ?? 'new',
      referralSource: dto.referralSource ?? null,
      referralReason: dto.referralReason ?? null,
      destination: dto.destination ?? 'doctor',
      departmentName: dto.departmentName ?? null,
      paymentMethod: dto.paymentMethod ?? null,
      receiptNumber: dto.receiptNumber ?? null,
      createdBy: request.user?.sub ?? null,
      updatedBy: request.user?.sub ?? null,
    });
    return this.encounters.save(encounter);
  }

  async listEncounters(params: {
    patientId?: string;
    status?: OpdEncounterStatus;
    doctorId?: string;
  }) {
    return this.encounters.find({
      where: {
        patient: params.patientId ? { id: params.patientId } : undefined,
        status: params.status,
        attendingDoctor: params.doctorId ? { id: params.doctorId } : undefined,
        type: 'opd',
      },
      relations: { patient: true, attendingDoctor: true },
      order: { startedAt: 'DESC' },
      take: 100,
    });
  }

  async getEncounter(id: string) {
    const encounter = await this.encounters.findOne({
      where: { id },
      relations: { patient: true, attendingDoctor: true },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    const [triage, consultation, diagnoses, notes, attachments] =
      await Promise.all([
        this.triages.findOne({
          where: { encounter: { id } },
          order: { createdAt: 'DESC' },
        }),
        this.consultations.findOne({
          where: { encounter: { id } },
          order: { createdAt: 'DESC' },
        }),
        this.diagnoses.find({ where: { encounter: { id } } }),
        this.notes.find({ where: { encounter: { id } }, order: { createdAt: 'DESC' } }),
        this.attachments.find({ where: { encounter: { id } } }),
      ]);
    return { ...encounter, triage, consultation, diagnoses, notes, attachments };
  }

  async updateStatus(
    id: string,
    status: OpdEncounterStatus,
    request: RequestContext,
  ) {
    await this.getEncounterEntity(id);
    await this.encounters.update(id, {
      status,
      endedAt: status === 'completed' ? new Date() : undefined,
      updatedBy: request.user?.sub ?? null,
    });
    return this.getEncounter(id);
  }

  async triage(id: string, dto: CreateTriageDto, request: RequestContext) {
    const encounter = await this.getEncounterEntity(id);
    const triage = await this.triages.save(
      this.triages.create({
        encounter,
        performedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        category: dto.category,
        colour: dto.colour,
        chiefComplaint: dto.chiefComplaint,
        painScore: dto.painScore ?? null,
        temperature: dto.temperature?.toString() ?? null,
        pulse: dto.pulse ?? null,
        respiratoryRate: dto.respiratoryRate ?? null,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        spo2: dto.spo2 ?? null,
        weight: dto.weight?.toString() ?? null,
        height: dto.height?.toString() ?? null,
        isRetriage: dto.isRetriage ?? false,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.encounters.update(id, {
      status: 'triaged',
      updatedBy: request.user?.sub ?? null,
    });
    return triage;
  }

  async triageQueue() {
    return this.encounters.find({
      where: { type: 'opd', status: 'registered' },
      relations: { patient: true },
      order: { startedAt: 'ASC' },
    });
  }

  async doctorQueue() {
    const encounters = await this.encounters.find({
      where: { type: 'opd', status: 'triaged' },
      relations: { patient: true },
      order: { startedAt: 'ASC' },
    });
    const triageByEncounter = new Map(
      (
        await this.triages.find({
          where: encounters.map((encounter) => ({
            encounter: { id: encounter.id },
          })),
          relations: { encounter: true },
          order: { createdAt: 'DESC' },
        })
      ).map((triage) => [triage.encounter?.id, triage]),
    );
    return encounters
      .map((encounter) => ({
        ...encounter,
        triage: triageByEncounter.get(encounter.id) ?? null,
      }))
      .sort((a, b) => {
        const aPriority = TRIAGE_PRIORITY[a.triage?.colour ?? 'green'];
        const bPriority = TRIAGE_PRIORITY[b.triage?.colour ?? 'green'];
        return aPriority - bPriority || a.startedAt.getTime() - b.startedAt.getTime();
      });
  }

  async createConsultation(
    encounterId: string,
    dto: CreateConsultationDto,
    request: RequestContext,
  ) {
    const encounter = await this.getEncounterEntity(encounterId);
    const consultation = await this.consultations.save(
      this.consultations.create({
        encounter,
        doctor: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        subjective: dto.subjective,
        objective: dto.objective,
        assessment: dto.assessment,
        plan: dto.plan,
        status: 'draft',
        followUpDate: dto.followUpDate ?? null,
        followUpInstructions: dto.followUpInstructions ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.encounters.update(encounterId, {
      status: 'in_consultation',
      attendingDoctor: request.user?.sub ? ({ id: request.user.sub } as never) : null,
      updatedBy: request.user?.sub ?? null,
    });
    return consultation;
  }

  async updateConsultation(
    consultationId: string,
    dto: UpdateConsultationDto,
    request: RequestContext,
  ) {
    const consultation = await this.consultations.findOne({
      where: { id: consultationId },
      relations: { encounter: true },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.consultations.update(consultationId, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.consultations.findOneOrFail({ where: { id: consultationId } });
  }

  async completeConsultation(consultationId: string, request: RequestContext) {
    const consultation = await this.consultations.findOne({
      where: { id: consultationId },
      relations: { encounter: true },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.consultations.update(consultationId, {
      status: 'completed',
      completedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    await this.encounters.update(consultation.encounter.id, {
      status: 'completed',
      endedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.getEncounter(consultation.encounter.id);
  }

  async addDiagnosis(
    encounterId: string,
    dto: CreateDiagnosisDto,
    request: RequestContext,
  ) {
    const encounter = await this.getEncounterEntity(encounterId);
    return this.diagnoses.save(
      this.diagnoses.create({
        encounter,
        icd10Code: dto.icd10Code ?? null,
        description: dto.description,
        type: dto.type,
        confirmed: dto.confirmed ?? false,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async addNote(encounterId: string, dto: CreateClinicalNoteDto, request: RequestContext) {
    const encounter = await this.getEncounterEntity(encounterId);
    if (dto.amendsNoteId && !dto.amendmentReason) {
      throw new BadRequestException('Amendment reason is required');
    }
    return this.notes.save(
      this.notes.create({
        encounter,
        amendsNote: dto.amendsNoteId ? ({ id: dto.amendsNoteId } as never) : null,
        type: dto.type,
        body: dto.body,
        amendmentReason: dto.amendmentReason ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async addAttachment(
    encounterId: string,
    dto: CreateAttachmentDto,
    request: RequestContext,
  ) {
    const encounter = await this.getEncounterEntity(encounterId);
    return this.attachments.save(
      this.attachments.create({
        encounter,
        ...dto,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async opdSummary() {
    const [total, completed, active] = await Promise.all([
      this.encounters.count({ where: { type: 'opd' } }),
      this.encounters.count({ where: { type: 'opd', status: 'completed' } }),
      this.encounters.count({
        where: { type: 'opd', status: Not('completed') },
      }),
    ]);
    const diagnoses = await this.diagnoses.find({ take: 200 });
    return {
      totalVisits: total,
      activeVisits: active,
      completedVisits: completed,
      topDiagnoses: Object.entries(
        diagnoses.reduce<Record<string, number>>((acc, diagnosis) => {
          acc[diagnosis.description] = (acc[diagnosis.description] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([description, count]) => ({ description, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  private async getEncounterEntity(id: string) {
    const encounter = await this.encounters.findOne({
      where: { id },
      relations: { patient: true },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    return encounter;
  }

  private async generateEncounterNo() {
    const year = new Date().getFullYear();
    const total = await this.encounters.count();
    return `OPD-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
