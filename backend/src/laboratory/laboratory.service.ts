import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { ClinicalOrderContextService } from '../clinical-order/clinical-order-context.service';
import { ClinicalOrderMirrorService } from '../clinical-order/clinical-order-mirror.service';
import { EncounterWorkflowService } from '../workflow/encounter-workflow.service';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  LabAttachment,
  LabPanel,
  LabRequest,
  LabRequestItem,
  LabResult,
  LabSample,
  LabTest,
} from './laboratory.entities';
import {
  CollectSampleDto,
  CreateLabAttachmentDto,
  CreateLabPanelDto,
  CreateLabRequestDto,
  CreateLabTestDto,
  EnterLabResultDto,
  ImportLabCatalogDto,
  ReceiveSampleDto,
} from './laboratory.dto';

@Injectable()
export class LaboratoryService {
  constructor(
    @InjectRepository(LabPanel) private readonly panels: Repository<LabPanel>,
    @InjectRepository(LabTest) private readonly tests: Repository<LabTest>,
    @InjectRepository(LabRequest) private readonly requests: Repository<LabRequest>,
    @InjectRepository(LabRequestItem)
    private readonly items: Repository<LabRequestItem>,
    @InjectRepository(LabSample) private readonly samples: Repository<LabSample>,
    @InjectRepository(LabResult) private readonly results: Repository<LabResult>,
    @InjectRepository(LabAttachment) private readonly attachments: Repository<LabAttachment>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    private readonly orderContext: ClinicalOrderContextService,
    private readonly clinicalOrderMirror: ClinicalOrderMirrorService,
    private readonly encounterWorkflow: EncounterWorkflowService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  createPanel(dto: CreateLabPanelDto, request: RequestContext) {
    return this.panels.save(
      this.panels.create({
        ...dto,
        description: dto.description ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listPanels() {
    return this.panels.find({ order: { name: 'ASC' } });
  }

  async createTest(dto: CreateLabTestDto, request: RequestContext) {
    const panel = dto.panelId ? await this.panels.findOne({ where: { id: dto.panelId } }) : null;
    return this.tests.save(
      this.tests.create({
        panel,
        name: dto.name,
        code: dto.code,
        sampleType: dto.sampleType,
        turnaroundHours: dto.turnaroundHours ?? null,
        referenceRange: dto.referenceRange ?? null,
        unit: dto.unit ?? null,
        criticalLow: dto.criticalLow?.toString() ?? null,
        criticalHigh: dto.criticalHigh?.toString() ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listTests() {
    return this.tests.find({ relations: { panel: true }, order: { name: 'ASC' } });
  }

  async createRequest(dto: CreateLabRequestDto, request: RequestContext) {
    if (!dto.testIds?.length && !dto.panelIds?.length) {
      throw new BadRequestException('Select at least one laboratory test or panel.');
    }

    const { encounter, admission } = await this.orderContext.resolveEncounter(
      {
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        allowWalkIn: true,
      },
      request,
    );

    const [directTests, panels] = await Promise.all([
      dto.testIds?.length ? this.tests.findBy({ id: In(dto.testIds) }) : Promise.resolve([]),
      dto.panelIds?.length ? this.panels.findBy({ id: In(dto.panelIds) }) : Promise.resolve([]),
    ]);

    if (dto.testIds?.length && directTests.length !== dto.testIds.length) {
      throw new BadRequestException('One or more selected tests are invalid or inactive.');
    }
    if (dto.panelIds?.length && panels.length !== dto.panelIds.length) {
      throw new BadRequestException('One or more selected panels are invalid or inactive.');
    }

    const expandedPanelTests: LabTest[] = [];
    const panelOnlyItems: LabPanel[] = [];
    for (const panel of panels) {
      const panelTests = await this.tests.find({
        where: { panel: { id: panel.id } },
        relations: { panel: true },
      });
      if (panelTests.length) {
        expandedPanelTests.push(...panelTests);
      } else {
        panelOnlyItems.push(panel);
      }
    }

    const seenTestIds = new Set<string>();
    const allTests: LabTest[] = [];
    for (const test of [...directTests, ...expandedPanelTests]) {
      if (!seenTestIds.has(test.id)) {
        seenTestIds.add(test.id);
        allTests.push(test);
      }
    }

    const itemRows = [
      ...allTests.map((test) => ({ test, panel: null as LabPanel | null })),
      ...panelOnlyItems.map((panel) => ({ test: null as LabTest | null, panel })),
    ];

    if (!itemRows.length) {
      throw new BadRequestException('No valid tests or panels were found for this order.');
    }

    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const labRequest = await this.requests.save(
      this.requests.create({
        patient,
        encounter,
        admission,
        requestNo: await this.generateRequestNo(),
        priority: dto.priority,
        notes: dto.notes ?? null,
        status: 'requested',
        cancelledReason: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.items.save(
      itemRows.map(({ test, panel }) =>
        this.items.create({
          request: labRequest,
          test,
          panel,
          status: 'requested',
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ),
    );
    await this.encounterWorkflow.markAwaitingResults(encounter.id, request);
    labRequest.patient = patient;
    labRequest.encounter = encounter;
    labRequest.admission = admission;
    await this.clinicalOrderMirror.mirrorLabRequest(labRequest, request, {
      testCount: itemRows.length,
    });
    this.realtime.publish(request.tenant?.code ?? 'demo', 'lab.updated', {
      requestId: labRequest.id,
      action: 'created',
    });
    return this.detail(labRequest.id);
  }

  listPatientRequests(patientId: string) {
    return this.requests.find({
      where: { patient: { id: patientId } },
      relations: { patient: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listPatientAttachments(patientId: string) {
    const requests = await this.requests.find({
      where: { patient: { id: patientId } },
    });
    if (!requests.length) return [];
    const requestIds = requests.map((row) => row.id);
    const attachments = await this.attachments.find({
      where: requestIds.map((id) => ({ request: { id } })),
      relations: { request: true },
      order: { createdAt: 'DESC' },
    });
    return attachments.map((attachment) => ({
      ...attachment,
      requestNo: attachment.request.requestNo,
    }));
  }

  async listRequests(status?: string, limit?: number, offset?: number) {
    const where: { status?: LabRequest['status'] } = {};
    if (status) where.status = status as LabRequest['status'];
    const usePagination = limit !== undefined || offset !== undefined;

    if (!usePagination) {
      return this.requests.find({
        where,
        relations: { patient: true, encounter: true },
        order: { createdAt: 'DESC' },
      });
    }

    const take = Math.min(limit ?? 50, 200);
    const skip = offset ?? 0;
    const [items, total] = await this.requests.findAndCount({
      where,
      relations: { patient: true, encounter: true },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { items, total, limit: take, offset: skip };
  }

  async detail(id: string) {
    const labRequest = await this.requests.findOne({
      where: { id },
      relations: { patient: true, encounter: true, admission: true },
    });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const [items, samples, attachments] = await Promise.all([
      this.items.find({ where: { request: { id } }, relations: { test: true, panel: true } }),
      this.samples.find({ where: { request: { id } } }),
      this.attachments.find({ where: { request: { id } }, order: { createdAt: 'DESC' } }),
    ]);
    return { ...labRequest, items, samples, attachments };
  }

  async collectSample(id: string, dto: CollectSampleDto, request: RequestContext) {
    const labRequest = await this.requests.findOne({ where: { id } });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const sample = await this.samples.save(
      this.samples.create({
        request: labRequest,
        barcode: await this.generateBarcode(),
        type: dto.type,
        collectedAt: new Date(),
        receivedAt: null,
        condition: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.requests.update(id, { status: 'sample_collected' });
    await this.items.update({ request: { id } }, { status: 'sample_collected' });
    return sample;
  }

  async addAttachment(id: string, dto: CreateLabAttachmentDto, request: RequestContext) {
    const labRequest = await this.requests.findOne({ where: { id } });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const attachment = await this.attachments.save(
      this.attachments.create({
        request: labRequest,
        filename: dto.filename,
        mimeType: dto.mimeType,
        storagePath: dto.storagePath,
        title: dto.title ?? dto.filename,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.requests.update(id, { status: 'resulted', updatedBy: request.user?.sub ?? null });
    return attachment;
  }

  async deleteAttachment(attachmentId: string, request: RequestContext) {
    const attachment = await this.attachments.findOne({
      where: { id: attachmentId },
      relations: { request: true },
    });
    if (!attachment) throw new NotFoundException('Lab attachment not found');
    await this.attachments.softRemove(attachment);
    return { id: attachmentId, requestId: attachment.request.id };
  }

  async receiveSample(sampleId: string, dto: ReceiveSampleDto, request: RequestContext) {
    await this.samples.update(sampleId, {
      condition: dto.condition,
      receivedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.samples.findOneOrFail({ where: { id: sampleId } });
  }

  async enterResult(dto: EnterLabResultDto, request: RequestContext) {
    const item = await this.items.findOne({
      where: { id: dto.requestItemId },
      relations: { test: true, request: true },
    });
    if (!item) throw new NotFoundException('Lab request item not found');
    const sample = dto.sampleId ? await this.samples.findOne({ where: { id: dto.sampleId } }) : null;
    const numericValue = Number(dto.value);
    const criticalLow = Number(item.test?.criticalLow);
    const criticalHigh = Number(item.test?.criticalHigh);
    let flag: LabResult['flag'] = 'normal';
    if (!Number.isNaN(numericValue) && !Number.isNaN(criticalLow) && numericValue < criticalLow) flag = 'critically_low';
    if (!Number.isNaN(numericValue) && !Number.isNaN(criticalHigh) && numericValue > criticalHigh) flag = 'critically_high';
    const result = await this.results.save(
      this.results.create({
        requestItem: item,
        sample,
        value: dto.value,
        unit: dto.unit ?? item.test?.unit ?? null,
        flag,
        referenceRange: item.test?.referenceRange ?? null,
        isCritical: flag === 'critically_low' || flag === 'critically_high',
        verifiedBy: null,
        verifiedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.items.update(item.id, { status: 'resulted' });
    await this.requests.update(item.request.id, { status: 'resulted' });

    if (result.isCritical) {
      const labRequest = await this.requests.findOne({
        where: { id: item.request.id },
        relations: {
          patient: true,
          encounter: { attendingDoctor: true },
          admission: { admittingDoctor: true },
        },
      });
      if (labRequest) {
        await this.notifications.notifyInvestigationStakeholders(
          this.notifications.investigationRecipients({
            createdBy: labRequest.createdBy,
            attendingDoctorId: labRequest.encounter?.attendingDoctor?.id,
            admittingDoctorId: labRequest.admission?.admittingDoctor?.id,
          }),
          {
            title: 'Critical lab result',
            body: `${labRequest.patient.firstName} ${labRequest.patient.lastName} — ${item.test?.name ?? 'Lab test'}: ${dto.value} ${dto.unit ?? ''}`.trim(),
            severity: 'critical',
            link: `/laboratory`,
            actorId: request.user?.sub ?? null,
          },
        );
      }
    }

    return result;
  }

  async verifyRequest(id: string, request: RequestContext) {
    const labRequest = await this.requests.findOne({
      where: { id },
      relations: {
        patient: true,
        encounter: { attendingDoctor: true },
        admission: { admittingDoctor: true },
      },
    });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const items = await this.items.find({ where: { request: { id } } });
    const results = await this.results.find({
      where: items.map((item) => ({ requestItem: { id: item.id } })),
    });
    const attachmentCount = await this.attachments.count({ where: { request: { id } } });
    if (!results.length && !attachmentCount) {
      throw new BadRequestException(
        'Enter structured results or upload a PDF report before verification.',
      );
    }
    await Promise.all(
      results.map((result) =>
        this.results.update(result.id, {
          verifiedBy: request.user?.sub ?? null,
          verifiedAt: new Date(),
          updatedBy: request.user?.sub ?? null,
        }),
      ),
    );
    await this.items.update({ request: { id } }, { status: 'verified' });
    await this.requests.update(id, { status: 'verified' });

    const hasCritical = results.some((result) => result.isCritical);
    await this.notifications.notifyInvestigationStakeholders(
      this.notifications.investigationRecipients({
        createdBy: labRequest.createdBy,
        attendingDoctorId: labRequest.encounter?.attendingDoctor?.id,
        admittingDoctorId: labRequest.admission?.admittingDoctor?.id,
      }),
      {
        title: hasCritical ? 'Critical lab result verified' : 'Lab result ready',
        body: `${labRequest.requestNo} for ${labRequest.patient.firstName} ${labRequest.patient.lastName} is ready for review.`,
        severity: hasCritical ? 'critical' : 'info',
        link: '/laboratory',
        actorId: request.user?.sub ?? null,
      },
    );
    this.realtime.publish(request.tenant?.code ?? 'demo', 'lab.updated', { requestId: id });
    await this.clinicalOrderMirror.syncSourceStatus('laboratory', id, 'verified', request);

    return this.resultsInbox();
  }

  async resultsInbox() {
    return this.results.find({
      where: { verifiedAt: Not(IsNull()) },
      relations: { requestItem: { request: { patient: true }, test: true, panel: true } },
      order: { enteredAt: 'DESC' },
      take: 100,
    });
  }

  criticalResults() {
    return this.results.find({
      where: { isCritical: true },
      relations: { requestItem: { request: { patient: true }, test: true } },
      order: { enteredAt: 'DESC' },
      take: 100,
    });
  }

  async reviewResult(id: string, request: RequestContext) {
    await this.results.update(id, {
      reviewedBy: request.user?.sub ?? null,
      reviewedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    return this.results.findOneOrFail({ where: { id } });
  }

  async importCatalog(dto: ImportLabCatalogDto, request: RequestContext) {
    const rows = parseCsv(dto.csv);
    if (!rows.length) {
      throw new BadRequestException('CSV is empty or missing a header row.');
    }

    const summary = { panelsCreated: 0, panelsSkipped: 0, testsCreated: 0, testsSkipped: 0, errors: [] as string[] };
    const panelByCode = new Map(
      (await this.panels.find()).map((panel) => [panel.code.toUpperCase(), panel]),
    );

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const type = (row.record_type ?? row.type ?? '').trim().toLowerCase();
      try {
        if (type === 'panel') {
          const code = (row.code ?? '').trim().toUpperCase();
          if (!code || !row.name) {
            summary.errors.push(`Line ${line}: panel requires name and code`);
            continue;
          }
          if (panelByCode.has(code)) {
            summary.panelsSkipped += 1;
            continue;
          }
          const panel = await this.panels.save(
            this.panels.create({
              name: row.name.trim(),
              code,
              description: row.description?.trim() || null,
              category: normalizeCategory(row.category),
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          panelByCode.set(code, panel);
          summary.panelsCreated += 1;
          continue;
        }

        if (type === 'test') {
          const code = (row.code ?? '').trim().toUpperCase();
          if (!code || !row.name || !row.sample_type) {
            summary.errors.push(`Line ${line}: test requires name, code, and sample_type`);
            continue;
          }
          const existing = await this.tests.findOne({ where: { code } });
          if (existing) {
            summary.testsSkipped += 1;
            continue;
          }
          const panelCode = (row.panel_code ?? '').trim().toUpperCase();
          const panel = panelCode ? panelByCode.get(panelCode) ?? null : null;
          if (panelCode && !panel) {
            summary.errors.push(`Line ${line}: unknown panel_code "${panelCode}"`);
            continue;
          }
          await this.tests.save(
            this.tests.create({
              panel,
              name: row.name.trim(),
              code,
              sampleType: normalizeSampleType(row.sample_type),
              turnaroundHours: row.turnaround_hours ? Number(row.turnaround_hours) : null,
              referenceRange: row.reference_range?.trim() || null,
              unit: row.unit?.trim() || null,
              criticalLow: row.critical_low ? String(row.critical_low) : null,
              criticalHigh: row.critical_high ? String(row.critical_high) : null,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          summary.testsCreated += 1;
          continue;
        }

        summary.errors.push(`Line ${line}: record_type must be "panel" or "test"`);
      } catch (error) {
        summary.errors.push(
          `Line ${line}: ${error instanceof Error ? error.message : 'Import failed'}`,
        );
      }
    }

    return summary;
  }

  private async generateRequestNo() {
    const year = new Date().getFullYear();
    const total = await this.requests.count();
    return `LAB-${year}-${String(total + 1).padStart(5, '0')}`;
  }

  private async generateBarcode() {
    const total = await this.samples.count();
    return `SMP-${new Date().getFullYear()}-${String(total + 1).padStart(6, '0')}`;
  }
}

function normalizeCategory(value?: string): LabPanel['category'] {
  const allowed = ['haematology', 'biochemistry', 'microbiology', 'immunology', 'urinalysis', 'coagulation'] as const;
  const normalized = (value ?? 'biochemistry').trim().toLowerCase() as LabPanel['category'];
  return allowed.includes(normalized) ? normalized : 'biochemistry';
}

function normalizeSampleType(value: string): LabTest['sampleType'] {
  const allowed = ['whole_blood', 'serum', 'plasma', 'urine', 'swab', 'stool', 'csf', 'tissue'] as const;
  const normalized = value.trim().toLowerCase() as LabTest['sampleType'];
  return allowed.includes(normalized) ? normalized : 'whole_blood';
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
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
