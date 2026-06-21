import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  LabPanel,
  LabRequest,
  LabRequestItem,
  LabResult,
  LabSample,
  LabTest,
} from './laboratory.entities';
import {
  CollectSampleDto,
  CreateLabPanelDto,
  CreateLabRequestDto,
  CreateLabTestDto,
  EnterLabResultDto,
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
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
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
    const [patient, encounter, admission, tests, panels] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.encounters.findOne({ where: { id: dto.encounterId } }),
      dto.admissionId ? this.admissions.findOne({ where: { id: dto.admissionId } }) : null,
      dto.testIds?.length ? this.tests.findBy({ id: In(dto.testIds) }) : Promise.resolve([]),
      dto.panelIds?.length ? this.panels.findBy({ id: In(dto.panelIds) }) : Promise.resolve([]),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!encounter) throw new NotFoundException('Encounter not found');
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
    await this.items.save([
      ...tests.map((test) =>
        this.items.create({
          request: labRequest,
          test,
          panel: null,
          status: 'requested',
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ),
      ...panels.map((panel) =>
        this.items.create({
          request: labRequest,
          test: null,
          panel,
          status: 'requested',
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ),
    ]);
    return this.detail(labRequest.id);
  }

  listRequests(status?: string) {
    return this.requests.find({
      where: { status: status as never },
      relations: { patient: true, encounter: true },
      order: { createdAt: 'DESC' },
    });
  }

  async detail(id: string) {
    const labRequest = await this.requests.findOne({
      where: { id },
      relations: { patient: true, encounter: true, admission: true },
    });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const [items, samples] = await Promise.all([
      this.items.find({ where: { request: { id } }, relations: { test: true, panel: true } }),
      this.samples.find({ where: { request: { id } } }),
    ]);
    return { ...labRequest, items, samples };
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
    return result;
  }

  async verifyRequest(id: string, request: RequestContext) {
    const labRequest = await this.requests.findOne({ where: { id } });
    if (!labRequest) throw new NotFoundException('Lab request not found');
    const items = await this.items.find({ where: { request: { id } } });
    const results = await this.results.find({
      where: items.map((item) => ({ requestItem: { id: item.id } })),
    });
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
