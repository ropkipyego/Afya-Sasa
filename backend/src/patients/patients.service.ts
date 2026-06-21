import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import QRCode from 'qrcode';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Appointment } from '../appointments/appointment.entities';
import { HduAdmission } from '../hdu/hdu.entities';
import { IcuAdmission } from '../icu/icu.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { LabResult } from '../laboratory/laboratory.entities';
import { Pregnancy } from '../maternity/maternity.entities';
import { Encounter } from '../opd/opd.entities';
import { RadiologyReport } from '../radiology/radiology.entities';
import { Referral } from '../referrals/referral.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import {
  Patient,
  PatientAllergy,
  PatientChronicCondition,
  PatientIdentifier,
  PatientNextOfKin,
} from './patient.entities';
import {
  CreatePatientDto,
  PatientAllergyDto,
  PatientChronicConditionDto,
  PatientIdentifierDto,
  PatientNextOfKinDto,
  UpdatePatientAllergyDto,
  UpdatePatientChronicConditionDto,
  UpdatePatientDto,
  UpdatePatientIdentifierDto,
  UpdatePatientNextOfKinDto,
} from './patient.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(PatientIdentifier)
    private readonly identifiers: Repository<PatientIdentifier>,
    @InjectRepository(PatientNextOfKin)
    private readonly nextOfKin: Repository<PatientNextOfKin>,
    @InjectRepository(PatientAllergy)
    private readonly allergies: Repository<PatientAllergy>,
    @InjectRepository(PatientChronicCondition)
    private readonly chronicConditions: Repository<PatientChronicCondition>,
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission)
    private readonly admissions: Repository<Admission>,
    @InjectRepository(LabResult)
    private readonly labResults: Repository<LabResult>,
    @InjectRepository(RadiologyReport)
    private readonly radiologyReports: Repository<RadiologyReport>,
    @InjectRepository(SurgeryBooking)
    private readonly surgeries: Repository<SurgeryBooking>,
    @InjectRepository(Pregnancy)
    private readonly pregnancies: Repository<Pregnancy>,
    @InjectRepository(IcuAdmission)
    private readonly icuAdmissions: Repository<IcuAdmission>,
    @InjectRepository(HduAdmission)
    private readonly hduAdmissions: Repository<HduAdmission>,
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    @InjectRepository(Referral)
    private readonly referrals: Repository<Referral>,
    private readonly notifications: NotificationsService,
  ) {}

  async search(params: {
    q?: string;
    identifier?: string;
    phone?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);

    const query = this.patients
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.identifiers', 'identifier')
      .where('patient.deleted_at IS NULL')
      .orderBy('patient.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (params.q?.trim()) {
      const term = `%${params.q.trim()}%`;
      query.andWhere(
        `(
          patient.first_name ILIKE :term OR
          patient.middle_name ILIKE :term OR
          patient.last_name ILIKE :term OR
          patient.patient_no ILIKE :term OR
          patient.primary_phone ILIKE :term OR
          patient.secondary_phone ILIKE :term OR
          identifier.value ILIKE :term
        )`,
        { term },
      );
    }

    if (params.identifier?.trim()) {
      query.andWhere('identifier.value ILIKE :identifier', {
        identifier: `%${params.identifier.trim()}%`,
      });
    }

    if (params.phone?.trim()) {
      query.andWhere(
        '(patient.primary_phone ILIKE :phone OR patient.secondary_phone ILIKE :phone)',
        { phone: `%${params.phone.trim()}%` },
      );
    }

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      meta: { page, pageSize, total },
    };
  }

  async create(dto: CreatePatientDto, request: RequestContext) {
    await this.ensureNoDuplicateIdentifier(dto.identifiers);

    const patientNo = await this.generatePatientNumber(
      request.tenant?.code ?? 'AFYA',
    );
    const patient = this.patients.create({
      ...dto,
      patientNo,
      qrCode: `afyasasa:patient:${patientNo}`,
      middleName: dto.middleName ?? null,
      secondaryPhone: dto.secondaryPhone ?? null,
      email: dto.email ?? null,
      bloodGroup: dto.bloodGroup ?? null,
      county: dto.county ?? null,
      registeredBy: request.user?.sub ?? null,
      createdBy: request.user?.sub ?? null,
      updatedBy: request.user?.sub ?? null,
      identifiers: dto.identifiers.map((identifier, index) =>
        this.identifiers.create({
          ...identifier,
          verified: identifier.verified ?? false,
          isPrimary: identifier.isPrimary ?? index === 0,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ),
      nextOfKin: (dto.nextOfKin ?? []).map((nextOfKin, index) => ({
        ...nextOfKin,
        secondaryPhone: nextOfKin.secondaryPhone ?? null,
        email: nextOfKin.email ?? null,
        address: nextOfKin.address ?? null,
        isEmergencyContact: index === 0,
        sortOrder: index,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      })) as PatientNextOfKin[],
    });

    const saved = await this.patients.save(patient);
    await this.notifications.queuePatientRegistered(saved);
    return this.findOne(saved.id);
  }

  async findOne(id: string) {
    const patient = await this.patients.findOne({
      where: { id },
      relations: {
        identifiers: true,
        nextOfKin: true,
        allergies: true,
        chronicConditions: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, request: RequestContext) {
    await this.findOne(id);
    await this.patients.update(id, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.findOne(id);
  }

  async softDelete(id: string): Promise<{ deleted: boolean }> {
    await this.findOne(id);
    await this.patients.softDelete(id);
    return { deleted: true };
  }

  findByQr(qrCode: string) {
    return this.patients.findOneOrFail({
      where: { qrCode },
      relations: {
        identifiers: true,
        nextOfKin: true,
        allergies: true,
        chronicConditions: true,
      },
    });
  }

  async history(id: string) {
    const patient = await this.findOne(id);
    return {
      patient,
      encounters: [],
      admissions: [],
      diagnoses: [],
      labResults: [],
      radiologyReports: [],
      message:
        'Patient history endpoint is reserved for OPD, inpatient, lab, and radiology phases.',
    };
  }

  async timeline(id: string) {
    const patient = await this.findOne(id);
    const [
      encounters,
      admissions,
      labResults,
      radiologyReports,
      surgeries,
      pregnancies,
      icuAdmissions,
      hduAdmissions,
      appointments,
      referrals,
    ] = await Promise.all([
      this.encounters.find({ where: { patient: { id } }, order: { createdAt: 'DESC' }, take: 50 }),
      this.admissions.find({ where: { patient: { id } }, relations: { ward: true, bed: true }, order: { createdAt: 'DESC' }, take: 50 }),
      this.labResults.find({
        where: { requestItem: { request: { patient: { id } } } },
        relations: { requestItem: { request: true, test: true, panel: true } },
        order: { enteredAt: 'DESC' },
        take: 50,
      }),
      this.radiologyReports.find({
        where: { request: { patient: { id } } },
        relations: { request: { modality: true } },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.surgeries.find({ where: { patient: { id } }, relations: { procedure: true, theatre: true }, order: { createdAt: 'DESC' }, take: 50 }),
      this.pregnancies.find({ where: { patient: { id } }, order: { createdAt: 'DESC' }, take: 50 }),
      this.icuAdmissions.find({ where: { admission: { patient: { id } } }, relations: { admission: true }, order: { createdAt: 'DESC' }, take: 50 }),
      this.hduAdmissions.find({ where: { admission: { patient: { id } } }, relations: { admission: true }, order: { createdAt: 'DESC' }, take: 50 }),
      this.appointments.find({ where: { patient: { id } }, order: { createdAt: 'DESC' }, take: 50 }),
      this.referrals.find({ where: { patient: { id } }, order: { createdAt: 'DESC' }, take: 50 }),
    ]);

    const events = [
      { type: 'registration', occurredAt: patient.createdAt, title: 'Patient registered', summary: patient.patientNo },
      ...encounters.map((item) => ({ type: 'visit', occurredAt: item.startedAt, title: `Encounter ${item.encounterNo}`, summary: `${item.type} - ${item.status}` })),
      ...admissions.map((item) => ({ type: 'admission', occurredAt: item.admittedAt, title: `Admission ${item.admissionNo}`, summary: `${item.ward?.name ?? 'Ward'} / ${item.bed?.bedNo ?? 'Bed'} - ${item.status}` })),
      ...labResults.map((item) => ({ type: 'lab_result', occurredAt: item.enteredAt, title: item.requestItem.test?.name ?? item.requestItem.panel?.name ?? 'Lab result', summary: `${item.value} ${item.unit ?? ''} (${item.flag})` })),
      ...radiologyReports.map((item) => ({ type: 'radiology', occurredAt: item.createdAt, title: `${item.request.modality?.name ?? 'Radiology'} report`, summary: item.impression })),
      ...surgeries.map((item) => ({ type: 'surgery', occurredAt: item.scheduledStartAt, title: item.procedure?.name ?? 'Surgery', summary: `${item.status} ${item.theatre?.name ?? ''}` })),
      ...pregnancies.map((item) => ({ type: 'maternity', occurredAt: item.createdAt, title: `Pregnancy ${item.pregnancyNo}`, summary: `${item.status} risk: ${item.riskLevel}` })),
      ...icuAdmissions.map((item) => ({ type: 'icu', occurredAt: item.admittedToIcuAt, title: 'ICU admission', summary: item.status })),
      ...hduAdmissions.map((item) => ({ type: 'hdu', occurredAt: item.admittedToHduAt, title: 'HDU admission', summary: item.status })),
      ...appointments.map((item) => ({ type: 'appointment', occurredAt: item.createdAt, title: `Appointment ${item.appointmentDate}`, summary: `${item.type} - ${item.status}` })),
      ...referrals.map((item) => ({ type: 'referral', occurredAt: item.createdAt, title: `${item.type} referral`, summary: `${item.status} - ${item.reason}` })),
    ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return { patient, events };
  }

  async qrCard(id: string) {
    const patient = await this.findOne(id);
    return {
      patientNo: patient.patientNo,
      qrCode: patient.qrCode,
      qrDataUrl: await QRCode.toDataURL(patient.qrCode, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
      }),
      printableText: `${patient.firstName} ${patient.lastName} | ${patient.patientNo}`,
    };
  }

  async detectDuplicates(dto: CreatePatientDto) {
    const identifierMatches = await Promise.all(
      dto.identifiers.map((identifier) =>
        this.identifiers.findOne({
          where: { type: identifier.type, value: identifier.value },
          relations: { patient: true },
        }),
      ),
    );
    const phoneMatches = await this.patients.find({
      where: [
        { primaryPhone: dto.primaryPhone },
        { secondaryPhone: dto.primaryPhone },
      ],
      take: 10,
    });

    return {
      identifierMatches: identifierMatches.filter(Boolean),
      phoneMatches,
      hasPotentialDuplicate:
        identifierMatches.some(Boolean) || phoneMatches.length > 0,
    };
  }

  async addIdentifier(
    patientId: string,
    dto: PatientIdentifierDto,
    request: RequestContext,
  ) {
    const patient = await this.findOne(patientId);
    await this.ensureNoDuplicateIdentifier([dto]);
    const saved = await this.identifiers.save(
      this.identifiers.create({
        ...dto,
        patient,
        verified: dto.verified ?? false,
        isPrimary: dto.isPrimary ?? false,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    return saved;
  }

  async updateIdentifier(
    patientId: string,
    identifierId: string,
    dto: UpdatePatientIdentifierDto,
    request: RequestContext,
  ) {
    await this.findOne(patientId);
    const identifier = await this.findOwnedRecord(
      this.identifiers,
      patientId,
      identifierId,
      'Identifier not found',
    );
    if (dto.type && dto.value) {
      await this.ensureNoDuplicateIdentifier([{ type: dto.type, value: dto.value }]);
    }
    await this.identifiers.update(identifier.id, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.identifiers.findOneOrFail({ where: { id: identifier.id } });
  }

  async removeIdentifier(patientId: string, identifierId: string) {
    await this.findOwnedRecord(
      this.identifiers,
      patientId,
      identifierId,
      'Identifier not found',
    );
    await this.identifiers.softDelete(identifierId);
    return { deleted: true };
  }

  async addNextOfKin(
    patientId: string,
    dto: PatientNextOfKinDto,
    request: RequestContext,
  ) {
    const patient = await this.findOne(patientId);
    return this.nextOfKin.save(
      this.nextOfKin.create({
        ...dto,
        patient,
        secondaryPhone: dto.secondaryPhone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async updateNextOfKin(
    patientId: string,
    nextOfKinId: string,
    dto: UpdatePatientNextOfKinDto,
    request: RequestContext,
  ) {
    const record = await this.findOwnedRecord(
      this.nextOfKin,
      patientId,
      nextOfKinId,
      'Next of kin not found',
    );
    await this.nextOfKin.update(record.id, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.nextOfKin.findOneOrFail({ where: { id: record.id } });
  }

  async removeNextOfKin(patientId: string, nextOfKinId: string) {
    await this.findOwnedRecord(
      this.nextOfKin,
      patientId,
      nextOfKinId,
      'Next of kin not found',
    );
    await this.nextOfKin.softDelete(nextOfKinId);
    return { deleted: true };
  }

  async addAllergy(
    patientId: string,
    dto: PatientAllergyDto,
    request: RequestContext,
  ) {
    const patient = await this.findOne(patientId);
    return this.allergies.save(
      this.allergies.create({
        ...dto,
        patient,
        onsetDate: dto.onsetDate ?? null,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async updateAllergy(
    patientId: string,
    allergyId: string,
    dto: UpdatePatientAllergyDto,
    request: RequestContext,
  ) {
    const record = await this.findOwnedRecord(
      this.allergies,
      patientId,
      allergyId,
      'Allergy not found',
    );
    await this.allergies.update(record.id, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.allergies.findOneOrFail({ where: { id: record.id } });
  }

  async removeAllergy(patientId: string, allergyId: string) {
    await this.findOwnedRecord(
      this.allergies,
      patientId,
      allergyId,
      'Allergy not found',
    );
    await this.allergies.softDelete(allergyId);
    return { deleted: true };
  }

  async addChronicCondition(
    patientId: string,
    dto: PatientChronicConditionDto,
    request: RequestContext,
  ) {
    const patient = await this.findOne(patientId);
    return this.chronicConditions.save(
      this.chronicConditions.create({
        ...dto,
        patient,
        icd10Code: dto.icd10Code ?? null,
        onsetDate: dto.onsetDate ?? null,
        notes: dto.notes ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async updateChronicCondition(
    patientId: string,
    conditionId: string,
    dto: UpdatePatientChronicConditionDto,
    request: RequestContext,
  ) {
    const record = await this.findOwnedRecord(
      this.chronicConditions,
      patientId,
      conditionId,
      'Chronic condition not found',
    );
    await this.chronicConditions.update(record.id, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.chronicConditions.findOneOrFail({ where: { id: record.id } });
  }

  async removeChronicCondition(patientId: string, conditionId: string) {
    await this.findOwnedRecord(
      this.chronicConditions,
      patientId,
      conditionId,
      'Chronic condition not found',
    );
    await this.chronicConditions.softDelete(conditionId);
    return { deleted: true };
  }

  private async ensureNoDuplicateIdentifier(
    identifiers: CreatePatientDto['identifiers'],
  ): Promise<void> {
    for (const identifier of identifiers) {
      const duplicate = await this.identifiers.findOne({
        where: { type: identifier.type, value: identifier.value },
        relations: { patient: true },
      });
      if (duplicate) {
        throw new ConflictException(
          `Duplicate patient identifier: ${identifier.type}`,
        );
      }
    }
  }

  private async generatePatientNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const total = await this.patients.count();
    return `${prefix.toUpperCase()}-${year}-${String(total + 1).padStart(5, '0')}`;
  }

  private filterBySecondarySearch(
    patients: Patient[],
    params: { identifier?: string; phone?: string },
  ): Patient[] {
    return patients.filter((patient) => {
      const identifierMatches =
        !params.identifier ||
        patient.identifiers?.some((identifier) =>
          identifier.value.includes(params.identifier ?? ''),
        );
      const phoneMatches =
        !params.phone ||
        patient.primaryPhone.includes(params.phone) ||
        patient.secondaryPhone?.includes(params.phone);
      return identifierMatches && phoneMatches;
    });
  }

  private async findOwnedRecord<T extends { id: string; patient: Patient }>(
    repository: Repository<T>,
    patientId: string,
    recordId: string,
    notFoundMessage: string,
  ): Promise<T> {
    const record = await repository.findOne({
      where: { id: recordId, patient: { id: patientId } } as never,
      relations: { patient: true } as never,
    });
    if (!record) {
      throw new NotFoundException(notFoundMessage);
    }
    return record;
  }
}
