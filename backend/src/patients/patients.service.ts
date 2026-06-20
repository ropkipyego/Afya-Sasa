import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import {
  Patient,
  PatientIdentifier,
  PatientNextOfKin,
} from './patient.entities';
import { CreatePatientDto, UpdatePatientDto } from './patient.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(PatientIdentifier)
    private readonly identifiers: Repository<PatientIdentifier>,
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

    const where = params.q
      ? [
          { firstName: ILike(`%${params.q}%`) },
          { lastName: ILike(`%${params.q}%`) },
          { patientNo: ILike(`%${params.q}%`) },
        ]
      : {};

    const [items, total] = await this.patients.findAndCount({
      where,
      relations: { identifiers: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return {
      items: this.filterBySecondarySearch(items, params),
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
    return this.patients.findOneOrFail({ where: { qrCode } });
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
}
