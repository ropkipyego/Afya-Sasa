import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { ClinicalOrderContextService } from '../clinical-order/clinical-order-context.service';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
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
    private readonly orderContext: ClinicalOrderContextService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
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
    const { encounter, admission } = await this.orderContext.resolveEncounter(
      {
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
      },
      request,
    );

    const [patient, modality] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.modalities.findOne({ where: { id: dto.modalityId } }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
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
    const where: { status?: RadiologyRequest['status'] } = {};
    if (status) where.status = status as RadiologyRequest['status'];
    return this.requests.find({
      where,
      relations: { patient: true, modality: true, encounter: true },
      order: { createdAt: 'DESC' },
    });
  }

  async detail(id: string) {
    const radiologyRequest = await this.requests.findOne({
      where: { id },
      relations: { patient: true, modality: true, encounter: true, admission: true },
    });
    if (!radiologyRequest) throw new NotFoundException('Radiology request not found');
    const [reports, attachments] = await Promise.all([
      this.reports.find({
        where: { request: { id } },
        order: { createdAt: 'DESC' },
      }),
      this.attachments.find({
        where: { request: { id } },
        order: { createdAt: 'DESC' },
      }),
    ]);
    return { ...radiologyRequest, reports, attachments };
  }

  async updateStatus(id: string, dto: UpdateRadiologyStatusDto, request: RequestContext) {
    await this.requests.update(id, {
      status: dto.status,
      updatedBy: request.user?.sub ?? null,
    });
    return this.requests.findOneOrFail({ where: { id } });
  }

  async createReport(id: string, dto: CreateRadiologyReportDto, request: RequestContext) {
    const radiologyRequest = await this.requests.findOne({
      where: { id },
      relations: {
        patient: true,
        encounter: { attendingDoctor: true },
        admission: { admittingDoctor: true },
        modality: true,
      },
    });
    if (!radiologyRequest) throw new NotFoundException('Radiology request not found');
    const report = await this.reports.save(
      this.reports.create({
        request: radiologyRequest,
        findings: dto.findings,
        impression: dto.impression,
        recommendation: dto.recommendation ?? null,
        verifiedBy: null,
        verifiedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.requests.update(id, { status: 'reported' });

    await this.notifications.notifyInvestigationStakeholders(
      this.notifications.investigationRecipients({
        createdBy: radiologyRequest.createdBy,
        attendingDoctorId: radiologyRequest.encounter?.attendingDoctor?.id,
        admittingDoctorId: radiologyRequest.admission?.admittingDoctor?.id,
      }),
      {
        title: 'Radiology report ready',
        body: `${radiologyRequest.requestNo} — ${radiologyRequest.modality?.name ?? 'Imaging'} for ${radiologyRequest.patient.firstName} ${radiologyRequest.patient.lastName} is ready.`,
        severity: 'info',
        link: '/radiology',
        actorId: request.user?.sub ?? null,
      },
    );

    return report;
  }

  async verifyReport(id: string, request: RequestContext) {
    const report = await this.reports.findOne({
      where: { id },
      relations: {
        request: {
          patient: true,
          encounter: { attendingDoctor: true },
          admission: { admittingDoctor: true },
          modality: true,
        },
      },
    });
    if (!report) throw new NotFoundException('Radiology report not found');
    await this.reports.update(id, {
      verifiedBy: request.user?.sub ?? null,
      verifiedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    await this.requests.update(report.request.id, { status: 'verified' });

    await this.notifications.notifyInvestigationStakeholders(
      this.notifications.investigationRecipients({
        createdBy: report.request.createdBy,
        attendingDoctorId: report.request.encounter?.attendingDoctor?.id,
        admittingDoctorId: report.request.admission?.admittingDoctor?.id,
      }),
      {
        title: 'Radiology report verified',
        body: `${report.request.requestNo} for ${report.request.patient.firstName} ${report.request.patient.lastName} has been verified.`,
        severity: 'info',
        link: '/radiology',
        actorId: request.user?.sub ?? null,
      },
    );
    this.realtime.publish(request.tenant?.code ?? 'demo', 'radiology.updated', { reportId: id });

    return this.reports.findOneOrFail({ where: { id } });
  }

  async verifyRequest(id: string, request: RequestContext) {
    const report = await this.reports.findOne({
      where: { request: { id } },
      order: { createdAt: 'DESC' },
    });
    if (!report) throw new NotFoundException('No radiology report found for this request');
    if (report.verifiedAt) throw new BadRequestException('Report is already verified');
    return this.verifyReport(report.id, request);
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
      where: { verifiedAt: Not(IsNull()) },
      relations: { request: { patient: true, modality: true } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async reviewReport(id: string, request: RequestContext) {
    await this.reports.update(id, {
      reviewedBy: request.user?.sub ?? null,
      reviewedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.reports.findOneOrFail({ where: { id } });
  }

  private async generateRequestNo() {
    const year = new Date().getFullYear();
    const total = await this.requests.count();
    return `RAD-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
