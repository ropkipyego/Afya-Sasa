import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { formatHospitalNumber } from '../common/hospital-numbering';
import { tenantChannel } from '../common/tenant-defaults';
import { ClinicalOrderContextService } from '../clinical-order/clinical-order-context.service';
import { ClinicalOrderMirrorService } from '../clinical-order/clinical-order-mirror.service';
import { EncounterWorkflowService } from '../workflow/encounter-workflow.service';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { AuditService } from '../core/audit/audit.service';
import { OrderableLabTest, LabReferenceRange } from './lab-catalog.entities';
import { LabCatalogService } from './lab-catalog.service';
import { assertLabTransition, isTerminalStatus, LAB_AUDIT } from './lab-lifecycle';
import { canAccessStructuredLabReport, canAmendLabResult, canCancelLabRequest } from './lab-access';
import { buildStructuredLabReportHtml } from './lab-report.builder';
import { AccommodationChargeService } from '../payments/accommodation-charge.service';
import type { PatientDemographics, SeedReferenceRange } from './lab-catalog.types';
import {
  mapPatientToRangeDemographics,
  resolveLegacyResultFlag,
  UNASSESSED_RANGE_LABEL,
} from './lab-result-engine';
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
  AmendLabResultDto,
  CancelLabRequestDto,
  CollectSampleDto,
  CreateLabAttachmentDto,
  CreateLabPanelDto,
  CreateLabRequestDto,
  CreateLabTestDto,
  EnterLabPanelResultsDto,
  EnterLabResultDto,
  ImportLabCatalogDto,
  ReceiveSampleDto,
  ScanLabSampleDto,
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
    @InjectRepository(OrderableLabTest)
    private readonly orderableTests: Repository<OrderableLabTest>,
    private readonly catalogService: LabCatalogService,
    private readonly orderContext: ClinicalOrderContextService,
    private readonly clinicalOrderMirror: ClinicalOrderMirrorService,
    private readonly encounterWorkflow: EncounterWorkflowService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly operationalCharges: AccommodationChargeService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Optional() @Inject(DataSource) private readonly dataSource: DataSource,
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
    if (!dto.testIds?.length && !dto.panelIds?.length && !dto.orderableTestIds?.length) {
      throw new BadRequestException('Select at least one laboratory test or panel.');
    }

    const { encounter, admission } = await this.orderContext.resolveEncounter(
      {
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        allowWalkIn: true,
        paymentMethod: dto.paymentMethod ?? null,
        payerScheme: dto.payerScheme ?? null,
        paymentReference: dto.paymentReference ?? null,
        mpesaPhone: dto.mpesaPhone ?? null,
      },
      request,
    );

    const [directTests, panels, orderableCatalogTests] = await Promise.all([
      dto.testIds?.length ? this.tests.findBy({ id: In(dto.testIds) }) : Promise.resolve([]),
      dto.panelIds?.length ? this.panels.findBy({ id: In(dto.panelIds) }) : Promise.resolve([]),
      dto.orderableTestIds?.length
        ? this.orderableTests.findBy({ id: In(dto.orderableTestIds), active: true })
        : Promise.resolve([]),
    ]);

    if (dto.testIds?.length && directTests.length !== dto.testIds.length) {
      throw new BadRequestException('One or more selected tests are invalid or inactive.');
    }
    if (dto.panelIds?.length && panels.length !== dto.panelIds.length) {
      throw new BadRequestException('One or more selected panels are invalid or inactive.');
    }
    if (dto.orderableTestIds?.length && orderableCatalogTests.length !== dto.orderableTestIds.length) {
      throw new BadRequestException('One or more selected catalog tests are invalid or inactive.');
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
      ...allTests.map((test) => ({
        test,
        panel: null as LabPanel | null,
        orderableTest: null as OrderableLabTest | null,
      })),
      ...panelOnlyItems.map((panel) => ({
        test: null as LabTest | null,
        panel,
        orderableTest: null as OrderableLabTest | null,
      })),
      ...orderableCatalogTests.map((orderableTest) => ({
        test: null as LabTest | null,
        panel: null as LabPanel | null,
        orderableTest,
      })),
    ];

    if (!itemRows.length) {
      throw new BadRequestException('No valid tests or panels were found for this order.');
    }

    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const paymentStatus =
      dto.paymentMethod === 'insurance'
        ? 'insurance_pending'
        : dto.paymentMethod === 'waived'
          ? 'waived'
          : dto.paymentMethod && dto.paymentReference
            ? 'paid'
            : 'pending';

    const billingAmount = await this.resolveBillingAmount(dto.billingAmount, orderableCatalogTests, request);
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
        paymentMethod: dto.paymentMethod ?? null,
        payerScheme: dto.payerScheme ?? null,
        paymentStatus,
        paymentReference: dto.paymentReference ?? null,
        mpesaPhone: dto.mpesaPhone ?? null,
        billingAmount,
        walkInSource: dto.walkInSource ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.items.save(
      itemRows.map(({ test, panel, orderableTest }) =>
        this.items.create({
          request: labRequest,
          test,
          panel,
          orderableTest,
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
    this.realtime.publish(tenantChannel(request), 'lab.updated', {
      requestId: labRequest.id,
      action: 'created',
    });
    const billed = Number(billingAmount);
    if (Number.isFinite(billed) && billed > 0) {
      await this.operationalCharges.upsertServiceCharge({
        patientId: patient.id,
        encounterId: encounter.id,
        admissionId: admission?.id ?? null,
        serviceLine: 'laboratory',
        serviceEntityId: labRequest.id,
        description: `${labRequest.requestNo} · ${itemRows.length} test${itemRows.length === 1 ? '' : 's'}`,
        amount: billed,
        source: 'LABORATORY',
        kind: 'laboratory_request',
        userId: request.user?.sub ?? null,
      });
    }
    return this.detail(labRequest.id);
  }

  listPatientRequests(patientId: string) {
    return this.requests
      .find({
        where: { patient: { id: patientId } },
        relations: { patient: true, encounter: true },
        order: { createdAt: 'DESC' },
        take: 100,
      })
      .then((rows) => this.attachItemsToRequests(rows));
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
      const rows = await this.requests.find({
        where,
        relations: { patient: true, encounter: true },
        order: { createdAt: 'DESC' },
      });
      return this.attachItemsToRequests(rows);
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
    return { items: await this.attachItemsToRequests(items), total, limit: take, offset: skip };
  }

  private async attachItemsToRequests<T extends LabRequest>(requests: T[]) {
    if (!requests.length) return requests.map((row) => ({ ...row, items: [] as LabRequestItem[] }));
    const requestIds = requests.map((row) => row.id);
    const allItems = await this.items.find({
      where: { request: { id: In(requestIds) } },
      relations: { orderableTest: true, test: true, panel: true, request: true },
      order: { createdAt: 'ASC' },
    });
    const itemsByRequest = new Map<string, LabRequestItem[]>();
    for (const item of allItems) {
      const requestId = item.request.id;
      const bucket = itemsByRequest.get(requestId) ?? [];
      bucket.push(item);
      itemsByRequest.set(requestId, bucket);
    }
    return requests.map((row) => ({
      ...row,
      items: itemsByRequest.get(row.id) ?? [],
    }));
  }

  async detail(id: string) {
    const labRequest = await this.requests.findOne({
      where: { id },
      relations: { patient: true, encounter: true, admission: true },
    });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const [items, samples, attachments, allResults] = await Promise.all([
      this.items.find({
        where: { request: { id } },
        relations: {
          test: true,
          panel: true,
          orderableTest: {
            department: true,
            specimen: true,
            parameters: { referenceRanges: true },
          },
        },
        order: { createdAt: 'ASC' },
      }),
      this.samples.find({ where: { request: { id } } }),
      this.attachments.find({ where: { request: { id } }, order: { createdAt: 'DESC' } }),
      this.results.find({
        where: { requestItem: { request: { id } } },
        relations: { parameter: true, requestItem: true },
        order: { enteredAt: 'ASC' },
      }),
    ]);

    const resultsByItem = new Map<string, LabResult[]>();
    for (const result of allResults) {
      const itemId = result.requestItem.id;
      const bucket = resultsByItem.get(itemId) ?? [];
      bucket.push(result);
      resultsByItem.set(itemId, bucket);
    }

    const itemsWithResults = items.map((item) => ({
      ...item,
      results: resultsByItem.get(item.id) ?? [],
    }));

    return { ...labRequest, items: itemsWithResults, samples, attachments };
  }

  async collectSample(id: string, dto: CollectSampleDto, request: RequestContext) {
    const labRequest = await this.requests.findOne({
      where: { id },
      relations: { patient: true },
    });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    try {
      assertLabTransition(labRequest.status, 'sample_collected', 'collect');
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid collection');
    }

    const requestItems = await this.items.find({
      where: { request: { id } },
      relations: { orderableTest: { specimen: true }, test: true, panel: true },
      order: { createdAt: 'ASC' },
    });
    const items = requestItems.length ? requestItems : [null];
    const samples = [];
    for (const item of items) {
      const sampleType =
        item?.orderableTest?.specimen?.name ||
        item?.test?.sampleType ||
        dto.type ||
        'blood';
      const saved = await this.samples.save(
        this.samples.create({
          request: labRequest,
          barcode: await this.generateBarcode(),
          type: sampleType,
          collectedAt: new Date(),
          receivedAt: null,
          condition: null,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
      samples.push({
        ...saved,
        testName:
          item?.orderableTest?.name ?? item?.test?.name ?? item?.panel?.name ?? sampleType,
      });
    }
    await this.requests.update(id, { status: 'sample_collected' });
    await this.items.update({ request: { id } }, { status: 'sample_collected' });
    await this.recordLabAudit(request, LAB_AUDIT.COLLECT, id, { sampleCount: samples.length });
    return {
      requestNo: labRequest.requestNo,
      patient: {
        firstName: labRequest.patient.firstName,
        lastName: labRequest.patient.lastName,
        patientNo: labRequest.patient.patientNo,
      },
      samples,
    };
  }

  async addAttachment(id: string, dto: CreateLabAttachmentDto, request: RequestContext) {
    const labRequest = await this.requests.findOne({
      where: { id },
      relations: {
        patient: true,
        encounter: { attendingDoctor: true },
        admission: { admittingDoctor: true },
      },
    });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    if (isTerminalStatus(labRequest.status)) {
      throw new BadRequestException('Attachments cannot be added after verification or cancellation.');
    }
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

    await this.notifications.notifyInvestigationStakeholders(
      this.notifications.investigationRecipients({
        createdBy: labRequest.createdBy,
        attendingDoctorId: labRequest.encounter?.attendingDoctor?.id,
        admittingDoctorId: labRequest.admission?.admittingDoctor?.id,
      }),
      {
        title: 'Lab report PDF uploaded',
        body: `${labRequest.requestNo} for ${labRequest.patient.firstName} ${labRequest.patient.lastName} — PDF report attached and awaiting verification.`,
        severity: 'info',
        link: '/laboratory',
        actorId: request.user?.sub ?? null,
      },
    );
    this.realtime.publish(tenantChannel(request), 'lab.updated', { requestId: id });

    return attachment;
  }

  async deleteAttachment(attachmentId: string, request: RequestContext) {
    const attachment = await this.attachments.findOne({
      where: { id: attachmentId },
      relations: { request: true },
    });
    if (!attachment) throw new NotFoundException('Lab attachment not found');
    if (isTerminalStatus(attachment.request?.status)) {
      throw new BadRequestException('Attachments cannot be removed after verification or cancellation.');
    }
    await this.attachments.softRemove(attachment);
    return { id: attachmentId, requestId: attachment.request.id };
  }

  async findSampleByBarcode(code: string) {
    const barcode = code.trim();
    if (!barcode) throw new BadRequestException('Specimen barcode is required');
    const sample = await this.samples.findOne({
      where: { barcode },
      relations: { request: { patient: true } },
    });
    if (!sample) throw new NotFoundException('No specimen matches this barcode');
    return this.toSpecimenScan(sample);
  }

  async scanSample(dto: ScanLabSampleDto, request: RequestContext) {
    const scan = await this.findSampleByBarcode(dto.barcode);
    if (dto.expectedRequestId && scan.requestId !== dto.expectedRequestId) {
      throw new BadRequestException(
        'This barcode belongs to a different lab request. The patient was not changed.',
      );
    }
    if (dto.expectedPatientId && scan.patientId !== dto.expectedPatientId) {
      throw new BadRequestException(
        'This barcode belongs to a different patient. The current patient was not changed.',
      );
    }
    if (scan.requestStatus === 'cancelled') {
      throw new BadRequestException('This lab request is cancelled');
    }
    if (scan.requestStatus === 'verified' && dto.action === 'process') {
      throw new BadRequestException('This specimen is already verified');
    }
    if (dto.action === 'receive') {
      if (scan.receivedAt) {
        throw new BadRequestException('This specimen has already been received');
      }
      if (!dto.condition) {
        throw new BadRequestException('Record the specimen condition before receiving. Adequate is not assumed.');
      }
      await this.receiveSample(scan.sampleId, { condition: dto.condition }, request);
      return this.findSampleByBarcode(dto.barcode);
    }
    if (dto.action === 'process' && scan.requestStatus === 'sample_collected') {
      await this.requests.update(scan.requestId, { status: 'processing' });
      return this.findSampleByBarcode(dto.barcode);
    }
    return scan;
  }

  private toSpecimenScan(sample: LabSample & { request?: LabRequest & { patient?: Patient } }) {
    return {
      sampleId: sample.id,
      barcode: sample.barcode,
      specimenType: sample.type,
      collectedAt: sample.collectedAt,
      receivedAt: sample.receivedAt,
      condition: sample.condition,
      rejectionReason: sample.rejectionReason ?? null,
      requestId: sample.request?.id ?? null,
      requestNo: sample.request?.requestNo ?? null,
      requestStatus: sample.request?.status ?? null,
      patientId: sample.request?.patient?.id ?? null,
      patientNo: sample.request?.patient?.patientNo ?? null,
      patientName: sample.request?.patient
        ? `${sample.request.patient.firstName} ${sample.request.patient.lastName}`
        : null,
      identity: 'specimen',
    };
  }

  async receiveSample(sampleId: string, dto: ReceiveSampleDto, request: RequestContext) {
    const sample = await this.samples.findOne({
      where: { id: sampleId },
      relations: { request: true },
    });
    if (!sample) throw new NotFoundException('Specimen not found');
    if (isTerminalStatus(sample.request?.status)) {
      throw new BadRequestException('This request is no longer open for specimen receipt.');
    }
    const rejected = dto.condition !== 'adequate';
    if (rejected && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required when the specimen is not adequate.');
    }
    await this.samples.update(sampleId, {
      condition: dto.condition,
      rejectionReason: rejected ? dto.rejectionReason?.trim() ?? null : null,
      receivedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    if (!rejected && sample.request && sample.request.status === 'sample_collected') {
      try {
        assertLabTransition(sample.request.status, 'processing', 'receive');
        await this.requests.update(sample.request.id, { status: 'processing' });
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Invalid receipt');
      }
    }
    await this.recordLabAudit(request, rejected ? LAB_AUDIT.REJECT : LAB_AUDIT.RECEIVE, sample.request?.id ?? sampleId, {
      sampleId,
      condition: dto.condition,
      rejectionReason: dto.rejectionReason ?? null,
    });
    return this.samples.findOneOrFail({ where: { id: sampleId } });
  }

  async enterResult(dto: EnterLabResultDto, request: RequestContext) {
    const item = await this.items.findOne({
      where: { id: dto.requestItemId },
      relations: {
        test: true,
        orderableTest: { parameters: { referenceRanges: true } },
        request: { patient: true },
      },
    });
    if (!item) throw new NotFoundException('Lab request item not found');
    await this.assertItemAcceptsResultEntry(item);

    const sample = dto.sampleId ? await this.samples.findOne({ where: { id: dto.sampleId } }) : null;
    const parameter = dto.parameterId
      ? item.orderableTest?.parameters?.find((entry) => entry.id === dto.parameterId) ??
        item.orderableTest?.parameters?.find((entry) => entry.code === dto.parameterCode)
      : item.orderableTest?.parameters?.find((entry) => entry.code === dto.parameterCode);

    let flag: LabResult['flag'] = 'unassessed';
    let referenceRange = item.test?.referenceRange ?? null;
    let unit = dto.unit ?? item.test?.unit ?? parameter?.unit ?? null;
    let isCritical = false;

    if (item.orderableTest && parameter) {
      const patient = toPatientDemographics(item.request.patient);
      const evaluation = await this.catalogService.evaluateResults({
        orderableTestCode: item.orderableTest.code,
        patient,
        results: [{ parameterCode: parameter.code, value: parseResultValue(dto.value) }],
      });
      const flagged = evaluation.flagged.find((entry) => entry.parameterCode === parameter.code);
      if (flagged) {
        flag = resolveLegacyResultFlag(
          flagged.flag,
          parseResultValue(dto.value),
          (parameter.referenceRanges ?? []).map(mapReferenceRangeEntity),
          patient,
        );
        referenceRange = flagged.referenceRangeLabel ?? referenceRange;
      }
      isCritical = flag === 'critically_low' || flag === 'critically_high';
    } else {
      const numericValue = Number(dto.value);
      const criticalLow = Number(item.test?.criticalLow);
      const criticalHigh = Number(item.test?.criticalHigh);
      if (!Number.isNaN(numericValue) && !Number.isNaN(criticalLow) && numericValue < criticalLow) {
        flag = 'critically_low';
      }
      if (!Number.isNaN(numericValue) && !Number.isNaN(criticalHigh) && numericValue > criticalHigh) {
        flag = 'critically_high';
      }
      isCritical = flag === 'critically_low' || flag === 'critically_high';
    }
    if (!referenceRange || flag === 'unassessed') {
      referenceRange = referenceRange || UNASSESSED_RANGE_LABEL;
    }

    const existingRows = await this.results.find({
      where: { requestItem: { id: item.id } },
      relations: { parameter: true },
      order: { createdAt: 'DESC' },
    });
    const match = parameter
      ? existingRows.find((row) => row.parameter?.id === parameter.id && !row.supersedesId)
      : existingRows.find((row) => !row.parameter && !row.supersedesId);
    if (match?.verifiedAt) {
      throw new BadRequestException(
        'A verified result already exists for this test and cannot be changed.',
      );
    }

    let result: LabResult;
    if (match) {
      const written = await this.results
        .createQueryBuilder()
        .update(LabResult)
        .set({
          value: dto.value,
          unit,
          flag,
          referenceRange,
          isCritical,
          updatedBy: request.user?.sub ?? null,
        })
        .where('id = :id', { id: match.id })
        .andWhere('verified_at IS NULL')
        .execute();
      if (!written.affected) {
        throw new BadRequestException(
          'A verified result already exists for this test and cannot be changed.',
        );
      }
      result = { ...match, value: dto.value, unit, flag, referenceRange, isCritical };
    } else {
      result = await this.results.save(
        this.results.create({
          requestItem: item,
          sample,
          parameter: parameter ?? null,
          value: dto.value,
          unit,
          flag,
          referenceRange,
          isCritical,
          verifiedBy: null,
          verifiedAt: null,
          reviewedBy: null,
          reviewedAt: null,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
    }
    await this.items.update(item.id, { status: 'resulted' });
    await this.requests.update(item.request.id, { status: 'resulted' });

    if (result.isCritical) {
      await this.notifyCriticalResult(item, dto.value, unit, request);
    }

    return result;
  }

  async enterPanelResults(dto: EnterLabPanelResultsDto, request: RequestContext) {
    const item = await this.items.findOne({
      where: { id: dto.requestItemId },
      relations: {
        orderableTest: { parameters: { referenceRanges: true } },
        request: { patient: true },
      },
    });
    const orderableTest = item?.orderableTest;
    if (!orderableTest) {
      throw new BadRequestException('Structured panel entry requires a catalog orderable test.');
    }
    if (!dto.results.length) {
      throw new BadRequestException('Enter at least one parameter result.');
    }
    await this.assertItemAcceptsResultEntry(item);

    return this.withRequestLock(item.request.id, async (em) => {
      const resultsRepo = em?.getRepository(LabResult) ?? this.results;
      const requestsRepo = em?.getRepository(LabRequest) ?? this.requests;
      const itemsRepo = em?.getRepository(LabRequestItem) ?? this.items;
      const latest = await requestsRepo.findOne({ where: { id: item.request.id } });
      if (isTerminalStatus(latest?.status)) {
        throw new BadRequestException(
          'This request is already verified. Finalized results cannot be changed.',
        );
      }

      const patient = toPatientDemographics(item.request.patient);
      const sample = dto.sampleId ? await this.samples.findOne({ where: { id: dto.sampleId } }) : null;
      const evaluation = await this.catalogService.evaluateResults({
        orderableTestCode: orderableTest.code,
        patient,
        results: dto.results.map((entry) => ({
          parameterCode: entry.parameterCode,
          value: parseResultValue(entry.value),
        })),
      });

      const flaggedByCode = new Map(evaluation.flagged.map((entry) => [entry.parameterCode, entry]));
      const parameterByCode = new Map((orderableTest.parameters ?? []).map((entry) => [entry.code, entry]));
      const entriesToSave = new Map<string, string>();
      for (const entry of dto.results) entriesToSave.set(entry.parameterCode, entry.value);
      for (const derived of evaluation.derived) entriesToSave.set(derived.parameterCode, String(derived.value));

      const saved: LabResult[] = [];
      let hasCritical = false;

      const existingResults = await resultsRepo.find({
        where: { requestItem: { id: item.id } },
        relations: { parameter: true },
      });
      const existingByParameterId = new Map<string, LabResult>();
      for (const row of existingResults) {
        if (!row.parameter?.id) continue;
        const current = existingByParameterId.get(row.parameter.id);
        if (!current) {
          existingByParameterId.set(row.parameter.id, row);
          continue;
        }
        if (row.supersedesId && !current.supersedesId) {
          existingByParameterId.set(row.parameter.id, row);
        }
      }

      for (const [parameterCode, value] of entriesToSave) {
        const parameter = parameterByCode.get(parameterCode);
        if (!parameter) continue;

        const flagged = flaggedByCode.get(parameterCode);
        const parsedValue = parseResultValue(value);
        const flag = flagged
          ? resolveLegacyResultFlag(
              flagged.flag,
              parsedValue,
              (parameter.referenceRanges ?? []).map(mapReferenceRangeEntity),
              patient,
            )
          : 'unassessed';
        const isCritical = flag === 'critically_low' || flag === 'critically_high';
        hasCritical = hasCritical || isCritical;
        const referenceRange =
          flagged?.referenceRangeLabel ||
          (flag === 'unassessed' ? UNASSESSED_RANGE_LABEL : null);

        const existing = existingByParameterId.get(parameter.id);
        if (existing) {
          if (existing.verifiedAt) {
            throw new BadRequestException(
              'A verified result already exists for this test and cannot be changed.',
            );
          }
          const written = await resultsRepo
            .createQueryBuilder()
            .update(LabResult)
            .set({
              value,
              unit: parameter.unit,
              flag,
              referenceRange: referenceRange ?? existing.referenceRange,
              isCritical,
              updatedBy: request.user?.sub ?? null,
            })
            .where('id = :id', { id: existing.id })
            .andWhere('verified_at IS NULL')
            .execute();
          if (!written.affected) {
            throw new BadRequestException(
              'A verified result already exists for this test and cannot be changed.',
            );
          }
          saved.push({
            ...existing,
            value,
            unit: parameter.unit,
            flag,
            referenceRange: referenceRange ?? existing.referenceRange,
            isCritical,
          });
        } else {
          try {
            saved.push(
              await resultsRepo.save(
                resultsRepo.create({
                  requestItem: item,
                  sample,
                  parameter,
                  value,
                  unit: parameter.unit,
                  flag,
                  referenceRange,
                  isCritical,
                  verifiedBy: null,
                  verifiedAt: null,
                  reviewedBy: null,
                  reviewedAt: null,
                  createdBy: request.user?.sub ?? null,
                  updatedBy: request.user?.sub ?? null,
                }),
              ),
            );
          } catch (error) {
            if (this.isUniqueViolation(error)) {
              throw new BadRequestException('A result already exists for this parameter.');
            }
            throw error;
          }
        }
      }

      if (!saved.length) {
        throw new BadRequestException('No matching catalog parameters were saved.');
      }

      await itemsRepo.update(item.id, { status: 'resulted' });
      await requestsRepo.update(item.request.id, { status: 'resulted' });

      if (hasCritical) {
        await this.notifyCriticalResult(item, 'Panel results', null, request);
      }

      return { saved, derived: evaluation.derived, flagged: evaluation.flagged };
    });
  }

  private async notifyCriticalResult(
    item: LabRequestItem,
    value: string,
    unit: string | null,
    request: RequestContext,
  ) {
    const labRequest = await this.requests.findOne({
      where: { id: item.request.id },
      relations: {
        patient: true,
        encounter: { attendingDoctor: true },
        admission: { admittingDoctor: true },
      },
    });
    if (!labRequest) return;

    await this.notifications.notifyInvestigationStakeholders(
      this.notifications.investigationRecipients({
        createdBy: labRequest.createdBy,
        attendingDoctorId: labRequest.encounter?.attendingDoctor?.id,
        admittingDoctorId: labRequest.admission?.admittingDoctor?.id,
      }),
      {
        title: 'Critical lab result',
        body: `${labRequest.patient.firstName} ${labRequest.patient.lastName} — ${
          item.orderableTest?.name ?? item.test?.name ?? 'Lab test'
        }: ${value} ${unit ?? ''}`.trim(),
        severity: 'critical',
        link: `/laboratory`,
        actorId: request.user?.sub ?? null,
      },
    );
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
    try {
      assertLabTransition(labRequest.status, 'verified', 'verify');
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid verification');
    }
    const items = await this.items.find({
      where: { request: { id } },
      relations: { orderableTest: { parameters: true } },
    });
    const results = items.length
      ? await this.results.find({
          where: items.map((item) => ({ requestItem: { id: item.id } })),
          relations: { parameter: true, requestItem: true },
        })
      : [];
    const catalogItems = items.filter((item) => (item.orderableTest?.parameters ?? []).length);
    if (catalogItems.length) {
      for (const item of catalogItems) {
        const required = (item.orderableTest?.parameters ?? []).filter(
          (parameter) => parameter.active !== false && !parameter.calculatedFormula,
        );
        const byCode = new Set(
          results
            .filter((row) => row.requestItem?.id === item.id && !row.supersedesId)
            .map((row) => row.parameter?.code)
            .filter(Boolean),
        );
        const missing = required.filter((parameter) => !byCode.has(parameter.code));
        if (missing.length) {
          throw new BadRequestException(
            `Structured results are required before verification. Missing: ${missing
              .map((parameter) => parameter.code)
              .join(', ')}. A PDF attachment is not a substitute.`,
          );
        }
      }
    } else if (!results.length) {
      throw new BadRequestException(
        'Enter structured results before verification. A PDF attachment is not a substitute for a result value.',
      );
    }
    const itemIds = items.map((item) => item.id);
    if (!itemIds.length) {
      throw new BadRequestException('This request has no tests to verify.');
    }
    await this.withRequestLock(id, async (em) => {
      const resultsRepo = em?.getRepository(LabResult) ?? this.results;
      const requestsRepo = em?.getRepository(LabRequest) ?? this.requests;
      const itemsRepo = em?.getRepository(LabRequestItem) ?? this.items;
      const latest = await requestsRepo.findOne({ where: { id } });
      if (!latest || isTerminalStatus(latest.status)) {
        throw new BadRequestException('This request is no longer open for verification.');
      }
      const verifiedAt = new Date();
      const stamp = await resultsRepo
        .createQueryBuilder()
        .update(LabResult)
        .set({
          verifiedBy: request.user?.sub ?? null,
          verifiedAt,
          updatedBy: request.user?.sub ?? null,
        })
        .where('verified_at IS NULL')
        .andWhere('request_item_id IN (:...ids)', { ids: itemIds })
        .execute();
      if (!stamp.affected && results.some((row) => !row.verifiedAt)) {
        throw new BadRequestException('Verification did not update any draft results. Retry.');
      }
      if (!stamp.affected && !results.length) {
        throw new BadRequestException(
          'Enter structured results before verification. A PDF attachment is not a substitute for a result value.',
        );
      }
      const requestStamp = await requestsRepo
        .createQueryBuilder()
        .update(LabRequest)
        .set({ status: 'verified', updatedBy: request.user?.sub ?? null })
        .where('id = :id', { id })
        .andWhere('status IN (:...open)', { open: ['resulted', 'processing', 'sample_collected'] })
        .execute();
      if (!requestStamp.affected) {
        throw new BadRequestException('This request is no longer open for verification.');
      }
      await itemsRepo.update({ request: { id } }, { status: 'verified' });
    });
    await this.recordLabAudit(request, LAB_AUDIT.VERIFY, id, { resultCount: results.length });

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
    this.realtime.publish(tenantChannel(request), 'lab.updated', { requestId: id });
    await this.clinicalOrderMirror.syncSourceStatus('laboratory', id, 'verified', request);

    return this.resultsInbox();
  }

  async resultsInbox(patientId?: string) {
    const qb = this.results
      .createQueryBuilder('result')
      .innerJoinAndSelect('result.requestItem', 'item')
      .innerJoinAndSelect('item.request', 'request')
      .leftJoinAndSelect('request.patient', 'patient')
      .leftJoinAndSelect('request.encounter', 'encounter')
      .leftJoinAndSelect('item.test', 'test')
      .leftJoinAndSelect('item.panel', 'panel')
      .leftJoinAndSelect('item.orderableTest', 'orderableTest')
      .where('result.verified_at IS NOT NULL')
      .orderBy('result.entered_at', 'DESC')
      .take(patientId ? 200 : 100);
    if (patientId) {
      qb.andWhere('patient.id = :patientId', { patientId });
    }
    return qb.getMany();
  }

  criticalResults(patientId?: string) {
    const qb = this.results
      .createQueryBuilder('result')
      .innerJoinAndSelect('result.requestItem', 'item')
      .innerJoinAndSelect('item.request', 'request')
      .leftJoinAndSelect('request.patient', 'patient')
      .leftJoinAndSelect('request.encounter', 'encounter')
      .leftJoinAndSelect('item.test', 'test')
      .leftJoinAndSelect('item.panel', 'panel')
      .leftJoinAndSelect('item.orderableTest', 'orderableTest')
      .where('result.is_critical = true')
      .orderBy('result.entered_at', 'DESC')
      .take(patientId ? 200 : 100);
    if (patientId) {
      qb.andWhere('patient.id = :patientId', { patientId });
    }
    return qb.getMany();
  }

  async reviewResult(id: string, request: RequestContext) {
    const result = await this.results.findOne({
      where: { id },
      relations: {
        requestItem: { request: { encounter: true } },
      },
    });
    if (!result) {
      throw new NotFoundException('Lab result not found');
    }

    await this.results.update(id, {
      reviewedBy: request.user?.sub ?? null,
      reviewedAt: new Date(),
      updatedBy: request.user?.sub ?? null,
    });
    await this.recordLabAudit(request, result.isCritical ? LAB_AUDIT.CRITICAL : LAB_AUDIT.REVIEW, id, {
      reviewedAt: new Date().toISOString(),
      isCritical: result.isCritical,
    });

    const encounter = result.requestItem?.request?.encounter;
    if (encounter?.id) {
      await this.encounterWorkflow.maybeReturnToConsultation(encounter.id, request);
    }

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

  private async resolveBillingAmount(
    explicit: number | undefined,
    orderableTests: OrderableLabTest[],
    request: RequestContext,
  ) {
    if (explicit != null && Number.isFinite(Number(explicit))) {
      return String(explicit);
    }
    if (!orderableTests.length) return null;
    const sum = await this.catalogService.sumSellPrices(
      orderableTests.map((test) => test.code),
      request,
    );
    return sum > 0 ? String(sum) : null;
  }

  async cancelRequest(id: string, dto: CancelLabRequestDto, request: RequestContext) {
    if (!canCancelLabRequest(request.user)) {
      throw new ForbiddenException('Permission denied');
    }
    const labRequest = await this.requests.findOne({ where: { id } });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    if (!dto.reason?.trim()) {
      throw new BadRequestException('A cancellation reason is required.');
    }
    try {
      assertLabTransition(labRequest.status, 'cancelled', 'cancel');
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid cancellation');
    }
    await this.withRequestLock(id, async (em) => {
      const requestsRepo = em?.getRepository(LabRequest) ?? this.requests;
      const itemsRepo = em?.getRepository(LabRequestItem) ?? this.items;
      const updated = await requestsRepo
        .createQueryBuilder()
        .update(LabRequest)
        .set({
          status: 'cancelled',
          cancelledReason: dto.reason.trim(),
          updatedBy: request.user?.sub ?? null,
        })
        .where('id = :id', { id })
        .andWhere('status NOT IN (:...terminal)', { terminal: ['verified', 'cancelled'] })
        .execute();
      if (!updated.affected) {
        throw new BadRequestException('This request cannot be cancelled.');
      }
      await itemsRepo.update({ request: { id } }, { status: 'cancelled' });
    });
    await this.recordLabAudit(request, LAB_AUDIT.CANCEL, id, { reason: dto.reason.trim() });
    return this.detail(id);
  }

  async amendResult(id: string, dto: AmendLabResultDto, request: RequestContext) {
    if (!canAmendLabResult(request.user)) {
      throw new ForbiddenException('Permission denied');
    }
    if (!this.amendmentEnabled()) {
      throw new ForbiddenException(
        'Result amendment is disabled until Jalaram laboratory policy is approved (AFYASASA_LAB_AMENDMENT_ENABLED).',
      );
    }
    if (!dto.reason?.trim()) {
      throw new BadRequestException('An amendment reason is required.');
    }
    const original = await this.results.findOne({
      where: { id },
      relations: { requestItem: { request: true, orderableTest: { parameters: { referenceRanges: true } } }, parameter: true },
    });
    if (!original) throw new NotFoundException('Lab result not found');
    if (!original.verifiedAt) {
      throw new BadRequestException('Amend the draft result by re-entering it. Amendment is only for verified values.');
    }
    const duplicate = await this.results.findOne({ where: { supersedesId: original.id } });
    if (duplicate) {
      throw new BadRequestException('This result already has an amendment. Verify or discard that draft first.');
    }
    const saved = await this.results.save(
      this.results.create({
        requestItem: original.requestItem,
        sample: original.sample,
        parameter: original.parameter,
        value: dto.value,
        unit: dto.unit ?? original.unit,
        flag: 'unassessed',
        referenceRange: UNASSESSED_RANGE_LABEL,
        isCritical: false,
        resultComment: dto.comment ?? null,
        supersedesId: original.id,
        amendmentReason: dto.reason.trim(),
        verifiedBy: null,
        verifiedAt: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.requests.update(original.requestItem.request.id, {
      status: 'resulted',
      updatedBy: request.user?.sub ?? null,
    });
    await this.recordLabAudit(request, LAB_AUDIT.AMEND, original.id, {
      amendmentId: saved.id,
      reason: dto.reason.trim(),
    });
    return saved;
  }

  async renderReport(id: string, request: RequestContext) {
    const detail = await this.detail(id);
    if (!canAccessStructuredLabReport(request.user, detail)) {
      throw new ForbiddenException(
        'Structured laboratory reports are limited to the ordering clinician, verifying laboratory staff, or an administrator. Department-level report scope is not available.',
      );
    }
    if (detail.status !== 'verified' && detail.status !== 'cancelled') {
      throw new BadRequestException('Print the structured report after verification, or from a cancelled record with history.');
    }
    const html = buildStructuredLabReportHtml(detail, {
      facilityName: this.config?.get?.('HOSPITAL_NAME') || 'Jalaram St. Christopher Hospital',
    });
    await this.recordLabAudit(request, LAB_AUDIT.REPORT, id, { status: detail.status });
    return { requestNo: detail.requestNo, status: detail.status, html };
  }

  private async generateRequestNo() {
    const total = await this.requests.count();
    return formatHospitalNumber('lab', total + 1);
  }

  private async generateBarcode() {
    const total = await this.samples.count();
    return formatHospitalNumber('smp', total + 1);
  }

  private async assertItemAcceptsResultEntry(item: LabRequestItem) {
    if (isTerminalStatus(item.request?.status)) {
      throw new BadRequestException(
        'This request is already verified. Finalized results cannot be changed.',
      );
    }
    const verifiedExisting = await this.results.findOne({
      where: { requestItem: { id: item.id } },
      order: { createdAt: 'DESC' },
    });
    if (verifiedExisting?.verifiedAt && !verifiedExisting.supersedesId) {
      throw new BadRequestException(
        'A verified result already exists for this test and cannot be changed.',
      );
    }
  }

  private amendmentEnabled() {
    return this.config?.get?.('AFYASASA_LAB_AMENDMENT_ENABLED') === 'true';
  }

  private isUniqueViolation(error: unknown) {
    const code =
      error instanceof QueryFailedError
        ? (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code
        : undefined;
    return code === '23505';
  }

  private async withRequestLock<T>(
    requestId: string,
    work: (em: EntityManager | null) => Promise<T>,
  ): Promise<T> {
    if (!this.dataSource?.transaction) return work(null);
    return this.dataSource.transaction(async (em) => {
      await em.query(
        `SELECT id FROM demo.lab_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [requestId],
      );
      return work(em);
    });
  }

  private async recordLabAudit(
    request: RequestContext,
    action: string,
    recordId: string | null,
    afterJson: Record<string, unknown>,
  ) {
    if (!this.audit?.record) return;
    await this.audit.record({
      userId: request.user?.sub ?? null,
      action,
      recordType: 'laboratory',
      recordId,
      afterJson,
      ip: request.ip ?? null,
      userAgent: typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      sessionId: request.user?.sid ?? null,
      endpoint: request.originalUrl ?? '/laboratory',
      httpCode: 200,
      durationMs: 0,
    });
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

function toPatientDemographics(patient: Patient): PatientDemographics {
  return mapPatientToRangeDemographics({
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
  });
}

function parseResultValue(value: string): number | string | boolean {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'positive') return true;
  if (trimmed.toLowerCase() === 'negative') return false;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && trimmed !== '' ? numeric : trimmed;
}

function mapReferenceRangeEntity(range: LabReferenceRange): SeedReferenceRange {
  return {
    gender: range.gender,
    ageMinDays: range.ageMinDays ?? undefined,
    ageMaxDays: range.ageMaxDays ?? undefined,
    rangeLow: range.rangeLow !== null ? Number(range.rangeLow) : undefined,
    rangeHigh: range.rangeHigh !== null ? Number(range.rangeHigh) : undefined,
    criticalLow: range.criticalLow !== null ? Number(range.criticalLow) : undefined,
    criticalHigh: range.criticalHigh !== null ? Number(range.criticalHigh) : undefined,
    normalTextValue: range.normalTextValue ?? undefined,
  };
}
