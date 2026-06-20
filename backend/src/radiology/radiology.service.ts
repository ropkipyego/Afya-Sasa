import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  RadiologyAttachment,
  RadiologyModality,
  RadiologyReport,
  RadiologyRequest,
} from './radiology.entities';
import {
  CreateModalityDto,
  CreateRadiologyAttachmentDto,
  CreateRadiologyReportDto,
  CreateRadiologyRequestDto,
  UpdateRadiologyStatusDto,
} from './radiology.dto';

@Injectable()
export class RadiologyService {
  constructor(
    @InjectRepository(RadiologyModality)
    private readonly modalities: Repository<RadiologyModality>,
    @InjectRepository(RadiologyRequest)
    private readonly requests: Repository<RadiologyRequest>,
    @InjectRepository(RadiologyReport)
    private readonly reports: Repository<RadiologyReport>,
    @InjectRepository(RadiologyAttachment)
    private readonly attachments: Repository<RadiologyAttachment>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
  ) {}

  createModality(dto: CreateModalityDto, request: RequestContext) {
    return this.modalities.save(
      this.modalities.create({
        ...dto,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listModalities() {
    return this.modalities.find({ order: { name: 'ASC' } });
  }

  async createRequest(dto: CreateRadiologyRequestDto, request: RequestContext) {
    const [patient, encounter, admission, modality] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.encounters.findOne({ where: { id: dto.encounterId } }),
      dto.admissionId ? this.admissions.findOne({ where: { id: dto.admissionId } }) : null,
      this.modalities.findOne({ where: { id: dto.modalityId } }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!encounter) throw new NotFoundException('Encounter not found');
    if (!modality) throw new NotFoundException('Modality not found');
    return this.requests.save(
      this.requests.create({
        patient,
        encounter,
        admission,
        modality,
        requestNo: await this.generateRequestNo(),
        bodyPart: dto.bodyPart,
        views: dto.views ?? null,
        clinicalIndication: dto.clinicalIndication,
        priority: dto.priority,
        status: 'requested',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listRequests(status?: string) {
    return this.requests.find({
      where: { status: status as never },
      relations: { patient: true, modality: true, encounter: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, dto: UpdateRadiologyStatusDto, request: RequestContext) {
    await this.requests.update(id, {
      status: dto.status,
      updatedBy: request.user?.sub ?? null,
    });
    return this.requests.findOneOrFail({ where: { id } });
  }

  async createReport(id: string, dto: CreateRadiologyReportDto, request: RequestContext) {
    const radiologyRequest = await this.requests.findOne({ where: { id } });
    if (!radiologyRequest) throw new NotFoundException('Radiology request not found');
    const report = await this.reports.save(
      this.reports.create({
        request: radiologyRequest,
        findings: dto.findings,
        impression: dto.impression,
        recommendation: dto.recommendation ?? null,
        verifiedBy: null,
        verifiedAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.requests.update(id, { status: 'reported' });
    return report;
  }

  async verifyReport(id: string, request: RequestContext) {
    const report = await this.reports.findOne({
      where: { id },
      relations: { request: true },
    });
    if (!report) throw new NotFoundException('Radiology report not found');
    await this.reports.update(id, {
      verifiedBy: request.user?.sub ?? null,
      verifiedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    await this.requests.update(report.request.id, { status: 'verified' });
    return this.reports.findOneOrFail({ where: { id } });
  }

  async addAttachment(
    id: string,
    dto: CreateRadiologyAttachmentDto,
    request: RequestContext,
  ) {
    const radiologyRequest = await this.requests.findOne({ where: { id } });
    if (!radiologyRequest) throw new NotFoundException('Radiology request not found');
    return this.attachments.save(
      this.attachments.create({
        request: radiologyRequest,
        ...dto,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async reportsInbox() {
    return this.reports.find({
      relations: { request: { patient: true, modality: true } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private async generateRequestNo() {
    const year = new Date().getFullYear();
    const total = await this.requests.count();
    return `RAD-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
