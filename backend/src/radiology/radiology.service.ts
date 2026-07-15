import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { ClinicalOrderContextService } from '../clinical-order/clinical-order-context.service';
import { ClinicalOrderMirrorService } from '../clinical-order/clinical-order-mirror.service';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AdminService } from '../core/admin/admin.service';
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
  ImportRadiologyCatalogDto,
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
    private readonly clinicalOrderMirror: ClinicalOrderMirrorService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly adminService: AdminService,
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

  async listStudies(request: RequestContext) {
    const settings = await this.adminService.getSettings(request);
    const catalog = (settings.clinicalCatalog ?? {}) as {
      radiologyStudies?: Array<{
        code: string
        name: string
        modalityCode: string
        bodyPart: string
        views?: string | null
        description?: string | null
      }>
    };
    return catalog.radiologyStudies ?? [];
  }

  async importCatalog(dto: ImportRadiologyCatalogDto, request: RequestContext) {
    const rows = parseRadiologyCsv(dto.csv);
    if (!rows.length) {
      throw new BadRequestException('CSV is empty or missing a header row.');
    }

    const summary = {
      modalitiesCreated: 0,
      modalitiesSkipped: 0,
      studiesCreated: 0,
      studiesSkipped: 0,
      errors: [] as string[],
    };
    const modalityByCode = new Map(
      (await this.modalities.find()).map((modality) => [
        modality.code.toUpperCase(),
        modality,
      ]),
    );
    const importedStudies: Array<{
      code: string
      name: string
      modalityCode: string
      bodyPart: string
      views: string | null
      description: string | null
    }> = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const type = (row.record_type ?? row.type ?? '').trim().toLowerCase();
      try {
        if (type === 'modality') {
          const code = (row.code ?? '').trim().toUpperCase();
          if (!code || !row.name) {
            summary.errors.push(`Line ${line}: modality requires name and code`);
            continue;
          }
          if (modalityByCode.has(code)) {
            summary.modalitiesSkipped += 1;
            continue;
          }
          const modality = await this.modalities.save(
            this.modalities.create({
              name: row.name.trim(),
              code,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          modalityByCode.set(code, modality);
          summary.modalitiesCreated += 1;
          continue;
        }

        if (type === 'study') {
          const code = (row.code ?? '').trim().toUpperCase();
          const modalityCode = (row.modality_code ?? '').trim().toUpperCase();
          if (!code || !row.name || !modalityCode || !row.body_part) {
            summary.errors.push(
              `Line ${line}: study requires name, code, modality_code, and body_part`,
            );
            continue;
          }
          if (!modalityByCode.has(modalityCode)) {
            summary.errors.push(`Line ${line}: unknown modality_code "${modalityCode}"`);
            continue;
          }
          importedStudies.push({
            code,
            name: row.name.trim(),
            modalityCode,
            bodyPart: row.body_part.trim(),
            views: row.views?.trim() || row.default_views?.trim() || null,
            description: row.description?.trim() || null,
          });
          continue;
        }

        summary.errors.push(`Line ${line}: record_type must be modality or study`);
      } catch (error) {
        summary.errors.push(
          `Line ${line}: ${error instanceof Error ? error.message : 'Import failed'}`,
        );
      }
    }

    if (importedStudies.length) {
      const settings = await this.adminService.getSettings(request);
      const catalog = (settings.clinicalCatalog ?? {}) as {
        radiologyStudies?: typeof importedStudies
      };
      const existing = catalog.radiologyStudies ?? [];
      const byCode = new Map(existing.map((study) => [study.code.toUpperCase(), study]));
      for (const study of importedStudies) {
        if (byCode.has(study.code)) {
          summary.studiesSkipped += 1;
        } else {
          summary.studiesCreated += 1;
        }
        byCode.set(study.code, study);
      }
      await this.adminService.updateSettings(
        {
          clinicalCatalog: {
            radiologyStudies: Array.from(byCode.values()),
          },
        },
        request,
      );
    }

    return summary;
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

    const radiologyRequest = await this.requests.save(
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
    radiologyRequest.patient = patient;
    radiologyRequest.encounter = encounter;
    radiologyRequest.admission = admission;
    await this.clinicalOrderMirror.mirrorRadiologyRequest(radiologyRequest, request, {
      modality: modality.name,
      bodyPart: dto.bodyPart,
    });
    this.realtime.publish(request.tenant?.code ?? 'demo', 'radiology.updated', {
      requestId: radiologyRequest.id,
      action: 'created',
    });
    return radiologyRequest;
  }

  async listRequests(status?: string, limit?: number, offset?: number) {
    const where: { status?: RadiologyRequest['status'] } = {};
    if (status) where.status = status as RadiologyRequest['status'];
    const usePagination = limit !== undefined || offset !== undefined;

    if (!usePagination) {
      return this.requests.find({
        where,
        relations: { patient: true, modality: true, encounter: true },
        order: { createdAt: 'DESC' },
      });
    }

    const take = Math.min(limit ?? 50, 200);
    const skip = offset ?? 0;
    const [items, total] = await this.requests.findAndCount({
      where,
      relations: { patient: true, modality: true, encounter: true },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { items, total, limit: take, offset: skip };
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
    await this.clinicalOrderMirror.syncSourceStatus('radiology', id, dto.status, request);
    this.realtime.publish(request.tenant?.code ?? 'demo', 'radiology.updated', {
      requestId: id,
      status: dto.status,
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

function parseRadiologyCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitRadiologyCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitRadiologyCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    return row;
  });
}

function splitRadiologyCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}
