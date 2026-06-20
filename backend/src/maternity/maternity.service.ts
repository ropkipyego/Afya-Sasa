import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  AncVisit,
  Delivery,
  LabourRecord,
  Newborn,
  PostnatalVisit,
  Pregnancy,
} from './maternity.entities';
import {
  CreateAncVisitDto,
  CreateDeliveryDto,
  CreateLabourRecordDto,
  CreateNewbornDto,
  CreatePostnatalVisitDto,
  RegisterPregnancyDto,
} from './maternity.dto';

@Injectable()
export class MaternityService {
  constructor(
    @InjectRepository(Pregnancy) private readonly pregnancies: Repository<Pregnancy>,
    @InjectRepository(AncVisit) private readonly ancVisits: Repository<AncVisit>,
    @InjectRepository(LabourRecord) private readonly labourRecords: Repository<LabourRecord>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Newborn) private readonly newborns: Repository<Newborn>,
    @InjectRepository(PostnatalVisit) private readonly postnatalVisits: Repository<PostnatalVisit>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
  ) {}

  async registerPregnancy(dto: RegisterPregnancyDto, request: RequestContext) {
    const [patient, encounter, admission] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      dto.encounterId ? this.encounters.findOne({ where: { id: dto.encounterId } }) : null,
      dto.admissionId ? this.admissions.findOne({ where: { id: dto.admissionId } }) : null,
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    return this.pregnancies.save(
      this.pregnancies.create({
        pregnancyNo: await this.generatePregnancyNo(),
        patient,
        registrationEncounter: encounter,
        admission,
        gravida: dto.gravida,
        para: dto.para,
        lmpDate: dto.lmpDate ?? null,
        edd: dto.edd ?? this.calculateEdd(dto.lmpDate),
        riskLevel: dto.riskLevel ?? 'low',
        riskNotes: dto.riskNotes ?? null,
        status: 'active',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listPregnancies(patientId?: string) {
    return this.pregnancies.find({
      where: { patient: patientId ? { id: patientId } : undefined },
      relations: { patient: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createAncVisit(id: string, dto: CreateAncVisitDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    return this.ancVisits.save(
      this.ancVisits.create({
        pregnancy,
        encounter: null,
        clinician: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        visitDate: dto.visitDate,
        gestationalAgeWeeks: dto.gestationalAgeWeeks ?? null,
        riskAssessment: dto.riskAssessment ?? null,
        plan: dto.plan,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async createLabourRecord(id: string, dto: CreateLabourRecordDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    const admission = dto.admissionId ? await this.admissions.findOne({ where: { id: dto.admissionId } }) : pregnancy.admission;
    return this.labourRecords.save(
      this.labourRecords.create({
        pregnancy,
        admission,
        cervicalDilationCm: dto.cervicalDilationCm?.toString() ?? null,
        contractions: dto.contractions ?? null,
        fetalHeartRate: dto.fetalHeartRate ?? null,
        membranesStatus: dto.membranesStatus ?? null,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async createDelivery(id: string, dto: CreateDeliveryDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    const admission = dto.admissionId ? await this.admissions.findOne({ where: { id: dto.admissionId } }) : pregnancy.admission;
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        pregnancy,
        admission,
        attendant: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        deliveryTime: new Date(dto.deliveryTime),
        mode: dto.mode,
        outcome: dto.outcome,
        complications: dto.complications ?? null,
        bloodLossMl: dto.bloodLossMl ?? null,
        notes: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.pregnancies.update(id, { status: 'delivered', updatedBy: request.user?.sub ?? null });
    return delivery;
  }

  async createNewborn(deliveryId: string, dto: CreateNewbornDto, request: RequestContext) {
    const delivery = await this.deliveries.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    const babyPatient = dto.babyPatientId ? await this.patients.findOne({ where: { id: dto.babyPatientId } }) : null;
    return this.newborns.save(
      this.newborns.create({
        delivery,
        babyPatient,
        sex: dto.sex,
        birthWeightGrams: dto.birthWeightGrams ?? null,
        apgar1Min: dto.apgar1Min ?? null,
        apgar5Min: dto.apgar5Min ?? null,
        apgar10Min: dto.apgar10Min ?? null,
        resuscitationRequired: dto.resuscitationRequired ?? false,
        status: dto.status,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async createPostnatalVisit(id: string, dto: CreatePostnatalVisitDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    return this.postnatalVisits.save(
      this.postnatalVisits.create({
        pregnancy,
        encounter: null,
        clinician: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        visitDate: dto.visitDate,
        motherCondition: dto.motherCondition,
        newbornCondition: dto.newbornCondition ?? null,
        feedingStatus: dto.feedingStatus ?? null,
        dangerSigns: dto.dangerSigns ?? null,
        plan: dto.plan,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async detail(id: string) {
    const pregnancy = await this.getPregnancy(id);
    const [ancVisits, labourRecords, deliveries, postnatalVisits] = await Promise.all([
      this.ancVisits.find({ where: { pregnancy: { id } } }),
      this.labourRecords.find({ where: { pregnancy: { id } } }),
      this.deliveries.find({ where: { pregnancy: { id } } }),
      this.postnatalVisits.find({ where: { pregnancy: { id } } }),
    ]);
    const newborns = await this.newborns.find({
      where: deliveries.map((delivery) => ({ delivery: { id: delivery.id } })),
    });
    return { ...pregnancy, ancVisits, labourRecords, deliveries, newborns, postnatalVisits };
  }

  private async getPregnancy(id: string) {
    const pregnancy = await this.pregnancies.findOne({
      where: { id },
      relations: { patient: true, admission: true },
    });
    if (!pregnancy) throw new NotFoundException('Pregnancy not found');
    return pregnancy;
  }

  private async generatePregnancyNo() {
    const year = new Date().getFullYear();
    const total = await this.pregnancies.count();
    return `PREG-${year}-${String(total + 1).padStart(5, '0')}`;
  }

  private calculateEdd(lmpDate?: string) {
    if (!lmpDate) return null;
    const date = new Date(lmpDate);
    date.setDate(date.getDate() + 280);
    return date.toISOString().slice(0, 10);
  }
}
