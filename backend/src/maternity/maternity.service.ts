import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient, PatientNextOfKin } from '../patients/patient.entities';
import {
  AncVisit,
  Delivery,
  LabourRecord,
  MaternityUnitAdmission,
  MotherBabyLink,
  Newborn,
  PartographEntry,
  PostnatalVisit,
  Pregnancy,
} from './maternity.entities';
import {
  CreateAncVisitDto,
  CreateDeliveryDto,
  CreateLabourRecordDto,
  CreateMaternityUnitAdmissionDto,
  CreateNewbornDto,
  CreatePartographEntryDto,
  CreatePostnatalVisitDto,
  RegisterNewbornPatientDto,
  RegisterPregnancyDto,
  RenameNewbornDto,
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
    @InjectRepository(PartographEntry) private readonly partographEntries: Repository<PartographEntry>,
    @InjectRepository(MotherBabyLink) private readonly motherBabyLinks: Repository<MotherBabyLink>,
    @InjectRepository(MaternityUnitAdmission)
    private readonly unitAdmissions: Repository<MaternityUnitAdmission>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientNextOfKin) private readonly nextOfKin: Repository<PatientNextOfKin>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
  ) {}

  async dashboard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const pregnancies = await this.pregnancies.find({ relations: { patient: true } });
    const active = pregnancies.filter((p) => p.status === 'active');
    const today = new Date().toISOString().slice(0, 10);
    const deliveriesToday = await this.deliveries.find({
      where: { deliveryTime: Between(startOfDay, new Date()) },
    });
    const caesareanToday = deliveriesToday.filter((d) => d.mode === 'cesarean');
    const unitCounts = await this.unitAdmissions.find({ where: { status: 'active' } });
    const newborns = await this.newborns.find({ relations: { babyPatient: true } });
    const nicuBabies = unitCounts.filter((u) => u.unit === 'nicu').length;
    const nurseryBabies = unitCounts.filter((u) => u.unit === 'nursery').length;
    const labourMothers = unitCounts.filter((u) => u.unit === 'labour').length;
    const postnatalMothers = unitCounts.filter((u) => u.unit === 'postnatal').length;
    const expectedDeliveries = active.filter((p) => p.edd && p.edd <= today).length;

    return {
      ancPatientsToday: active.length,
      mothersInLabour: labourMothers,
      deliveriesToday: deliveriesToday.length,
      caesareanDeliveries: caesareanToday.length,
      highRiskMothers: active.filter((p) => p.riskLevel === 'high').length,
      postnatalMothers,
      nurseryBabies: nurseryBabies || newborns.filter((n) => n.status === 'alive').length,
      nicuBabies,
      expectedDeliveries,
    };
  }

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
    const where: { patient?: { id: string } } = {};
    if (patientId) where.patient = { id: patientId };
    return this.pregnancies.find({
      where,
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
        weightKg: dto.weightKg?.toString() ?? null,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        fetalHeartRate: dto.fetalHeartRate ?? null,
        fundalHeightCm: dto.fundalHeightCm?.toString() ?? null,
        ultrasoundSummary: dto.ultrasoundSummary ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async createLabourRecord(id: string, dto: CreateLabourRecordDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    const admission = dto.admissionId
      ? await this.admissions.findOne({ where: { id: dto.admissionId } })
      : pregnancy.admission;
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

  async createPartographEntry(id: string, dto: CreatePartographEntryDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    const alert = this.evaluatePartographAlert(dto);
    return this.partographEntries.save(
      this.partographEntries.create({
        pregnancy,
        cervicalDilationCm: dto.cervicalDilationCm?.toString() ?? null,
        contractionsPer10Min: dto.contractionsPer10Min ?? null,
        contractionDurationSec: dto.contractionDurationSec ?? null,
        fetalHeartRate: dto.fetalHeartRate ?? null,
        maternalPulse: dto.maternalPulse ?? null,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        temperatureC: dto.temperatureC?.toString() ?? null,
        liquorStatus: dto.liquorStatus ?? null,
        moulding: dto.moulding ?? null,
        descent: dto.descent ?? null,
        alertFlag: alert.flagged,
        alertMessage: alert.message,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listPartograph(id: string) {
    return this.partographEntries.find({
      where: { pregnancy: { id } },
      order: { recordedAt: 'ASC' },
    });
  }

  async createDelivery(id: string, dto: CreateDeliveryDto, request: RequestContext) {
    const pregnancy = await this.getPregnancy(id);
    const admission = dto.admissionId
      ? await this.admissions.findOne({ where: { id: dto.admissionId } })
      : pregnancy.admission;
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
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId },
      relations: { pregnancy: { patient: true } },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    const babyPatient = dto.babyPatientId
      ? await this.patients.findOne({ where: { id: dto.babyPatientId } })
      : null;
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
        tempName: dto.babyName ? null : this.buildTempBabyName(delivery.pregnancy.patient, dto.birthOrder ?? 1),
        babyName: dto.babyName ?? null,
        birthOrder: dto.birthOrder ?? 1,
        multipleBirth: dto.multipleBirth ?? 'singleton',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async registerNewbornPatient(deliveryId: string, dto: RegisterNewbornPatientDto, request: RequestContext) {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId },
      relations: { pregnancy: { patient: true } },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    const mother = delivery.pregnancy.patient;
    const birthOrder = dto.birthOrder ?? 1;
    const tempName = dto.babyName
      ? null
      : this.buildTempBabyName(mother, birthOrder, dto.multipleBirth ?? 'singleton');
    const displayName = dto.babyName ?? tempName ?? `Baby Of ${mother.firstName} ${mother.lastName}`;
    const nameParts = displayName.split(' ');
    const babyPatient = await this.patients.save(
      this.patients.create({
        patientNo: await this.generatePatientNumber(request.tenant?.code ?? 'AFYA'),
        firstName: nameParts.slice(0, -1).join(' ') || displayName,
        lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1]! : mother.lastName,
        middleName: null,
        dateOfBirth: delivery.deliveryTime.toISOString().slice(0, 10),
        gender: dto.sex,
        primaryPhone: mother.primaryPhone,
        secondaryPhone: mother.secondaryPhone,
        email: mother.email,
        bloodGroup: null,
        county: mother.county,
        subCounty: mother.subCounty,
        ward: mother.ward,
        village: mother.village,
        postalAddress: mother.postalAddress,
        nationality: mother.nationality,
        maritalStatus: null,
        occupation: null,
        religion: mother.religion,
        qrCode: '',
        registeredBy: request.user?.sub ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    babyPatient.qrCode = `afyasasa:patient:${babyPatient.patientNo}`;
    await this.patients.save(babyPatient);

    const motherKin = await this.nextOfKin.find({ where: { patient: { id: mother.id } } });
    for (const kin of motherKin) {
      await this.nextOfKin.save(
        this.nextOfKin.create({
          patient: babyPatient,
          name: kin.name,
          relationship: kin.relationship,
          primaryPhone: kin.primaryPhone,
          secondaryPhone: kin.secondaryPhone,
          email: kin.email,
          address: kin.address,
          isEmergencyContact: kin.isEmergencyContact,
          sortOrder: kin.sortOrder,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }

    const newborn = await this.newborns.save(
      this.newborns.create({
        delivery,
        babyPatient,
        sex: dto.sex,
        birthWeightGrams: dto.birthWeightGrams ?? null,
        apgar1Min: dto.apgar1Min ?? null,
        apgar5Min: dto.apgar5Min ?? null,
        apgar10Min: null,
        resuscitationRequired: false,
        status: dto.status ?? 'alive',
        tempName,
        babyName: dto.babyName ?? null,
        birthOrder,
        multipleBirth: dto.multipleBirth ?? 'singleton',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    await this.motherBabyLinks.save(
      this.motherBabyLinks.create({
        motherPatient: mother,
        babyPatient,
        newborn,
        delivery,
        birthDate: delivery.deliveryTime.toISOString().slice(0, 10),
        deliveryType: delivery.mode,
        birthOrder,
        multipleBirth: dto.multipleBirth ?? 'singleton',
        status: 'active',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    return { newborn, babyPatient, motherBabyLink: true };
  }

  async renameNewborn(newbornId: string, dto: RenameNewbornDto, request: RequestContext) {
    const newborn = await this.newborns.findOne({
      where: { id: newbornId },
      relations: { babyPatient: true },
    });
    if (!newborn) throw new NotFoundException('Newborn not found');
    await this.newborns.update(newbornId, {
      babyName: dto.babyName,
      renamedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    if (newborn.babyPatient) {
      const parts = dto.babyName.trim().split(' ');
      await this.patients.update(newborn.babyPatient.id, {
        firstName: parts.slice(0, -1).join(' ') || dto.babyName,
        lastName: parts.length > 1 ? parts[parts.length - 1]! : newborn.babyPatient.lastName,
        updatedBy: request.user?.sub ?? null,
      });
    }
    return this.newborns.findOneOrFail({ where: { id: newbornId }, relations: { babyPatient: true } });
  }

  listMotherBabyRegistry() {
    return this.motherBabyLinks.find({
      relations: { motherPatient: true, babyPatient: true, delivery: true, newborn: true },
      order: { createdAt: 'DESC' },
    });
  }

  async admitToUnit(dto: CreateMaternityUnitAdmissionDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return this.unitAdmissions.save(
      this.unitAdmissions.create({
        patient,
        unit: dto.unit,
        pregnancy: dto.pregnancyId ? ({ id: dto.pregnancyId } as never) : null,
        newborn: dto.newbornId ? ({ id: dto.newbornId } as never) : null,
        clinicalSummary: dto.clinicalSummary ?? null,
        feedingStatus: dto.feedingStatus ?? null,
        oxygenSupport: dto.oxygenSupport ?? null,
        incubatorStatus: dto.incubatorStatus ?? null,
        weightGrams: dto.weightGrams ?? null,
        notes: dto.notes ?? null,
        status: 'active',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listUnitAdmissions(unit?: string) {
    return this.unitAdmissions.find({
      where: unit ? { unit: unit as never, status: 'active' } : { status: 'active' },
      relations: { patient: true, pregnancy: { patient: true }, newborn: true },
      order: { admittedAt: 'DESC' },
    });
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
    const [ancVisits, labourRecords, deliveries, postnatalVisits, partographEntries] = await Promise.all([
      this.ancVisits.find({ where: { pregnancy: { id } }, order: { visitDate: 'ASC' } }),
      this.labourRecords.find({ where: { pregnancy: { id } }, order: { recordedAt: 'ASC' } }),
      this.deliveries.find({ where: { pregnancy: { id } } }),
      this.postnatalVisits.find({ where: { pregnancy: { id } } }),
      this.partographEntries.find({ where: { pregnancy: { id } }, order: { recordedAt: 'ASC' } }),
    ]);
    const newborns = await this.newborns.find({
      where: deliveries.map((delivery) => ({ delivery: { id: delivery.id } })),
      relations: { babyPatient: true },
    });
    return { ...pregnancy, ancVisits, labourRecords, deliveries, newborns, postnatalVisits, partographEntries };
  }

  private evaluatePartographAlert(dto: CreatePartographEntryDto) {
    if (dto.fetalHeartRate != null && (dto.fetalHeartRate < 110 || dto.fetalHeartRate > 160)) {
      return { flagged: true, message: 'Fetal heart rate outside normal range (110–160 bpm).' };
    }
    if (dto.bpSystolic != null && dto.bpSystolic >= 140) {
      return { flagged: true, message: 'Maternal blood pressure elevated — review for pre-eclampsia.' };
    }
    if (dto.temperatureC != null && dto.temperatureC >= 38) {
      return { flagged: true, message: 'Maternal fever — assess for infection.' };
    }
    return { flagged: false, message: null };
  }

  private buildTempBabyName(
    mother: Patient,
    birthOrder: number,
    multipleBirth: 'singleton' | 'twin' | 'triplet' | 'higher_order' = 'singleton',
  ) {
    const motherName = `${mother.firstName} ${mother.lastName}`.trim();
    if (multipleBirth === 'singleton') return `Baby Of ${motherName}`;
    const suffix = birthOrder === 1 ? 'A' : birthOrder === 2 ? 'B' : birthOrder === 3 ? 'C' : String(birthOrder);
    return `Baby ${suffix} Of ${motherName}`;
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

  private async generatePatientNumber(tenantCode: string) {
    const prefix = tenantCode.slice(0, 4).toUpperCase();
    const total = await this.patients.count();
    return `${prefix}-${String(total + 1).padStart(6, '0')}`;
  }

  private calculateEdd(lmpDate?: string) {
    if (!lmpDate) return null;
    const date = new Date(lmpDate);
    date.setDate(date.getDate() + 280);
    return date.toISOString().slice(0, 10);
  }
}
