import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { TenantSettings } from '../core/core.entities';
import { Admission, BedTransferLog } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { Patient } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import { Charge, chargeRemaining, chargesEnabled } from './charge.entities';
import { PaymentTransaction, type PaymentServiceLine } from './payment.entities';
import {
  accommodationChargeEntityId,
  chargeSourceLabel,
  defaultHospitalChargeCatalogue,
  emptyJobStatus,
  paginateCatalogueItems,
  planAccommodationCharges,
  previewCatalogueRows,
  QUICKBOOKS_MAPPING_RULES,
  readHospitalChargeCatalogue,
  resolveChargeUnitPrice,
  serviceLineForCategory,
  type CatalogueImportRow,
  type HospitalChargeCatalogue,
  type HospitalChargeCategory,
  type HospitalChargeItem,
  type HospitalChargePolicy,
} from './hospital-charges';

@Injectable()
export class AccommodationChargeService {
  private readonly logger = new Logger(AccommodationChargeService.name);

  constructor(
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(PaymentTransaction) private readonly transactions: Repository<PaymentTransaction>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(BedTransferLog) private readonly transfers: Repository<BedTransferLog>,
    @InjectRepository(TenantSettings) private readonly settings: Repository<TenantSettings>,
    @InjectRepository(LabRequest) private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(RadiologyRequest) private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(ClinicalOrder) private readonly clinicalOrders: Repository<ClinicalOrder>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
  ) {}

  async getCatalogue(request?: RequestContext): Promise<HospitalChargeCatalogue> {
    const settings = await this.loadSettings(request);
    return readHospitalChargeCatalogue((settings?.clinicalCatalog as Record<string, unknown>) ?? null);
  }

  async saveCatalogue(
    patch: { policy?: Partial<HospitalChargePolicy>; items?: HospitalChargeItem[] },
    request: RequestContext,
  ) {
    const settings = await this.requireSettings(request);
    const current = readHospitalChargeCatalogue((settings.clinicalCatalog as Record<string, unknown>) ?? null);
    const items = Array.isArray(patch.items)
      ? this.mergeItems(current.items, patch.items.map((item) => this.normalizeItem(item)))
      : current.items;
    const next: HospitalChargeCatalogue = {
      policy: { ...current.policy, ...(patch.policy ?? {}) },
      items,
      job: current.job,
      oxygen: current.oxygen,
    };
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    catalog.hospitalCharges = next;
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
    return next;
  }

  async jobStatus(request?: RequestContext) {
    const catalogue = await this.getCatalogue(request);
    return {
      enabled: chargesEnabled(),
      ...catalogue.job,
      policy: catalogue.policy,
      unpricedAutomaticItems: catalogue.items.filter(
        (item) => item.automatic && item.active && resolveChargeUnitPrice(item, new Date().toISOString().slice(0, 10)) == null,
      ).map((item) => ({ code: item.code, name: item.name })),
    };
  }

  async processEligibleAdmissions(request?: RequestContext, admissionId?: string) {
    if (!chargesEnabled()) {
      return {
        generated: 0,
        skipped: 0,
        errors: [] as string[],
        admissions: 0,
        message: 'Operational charges are disabled (AFYASASA_CHARGES_ENABLED).',
      };
    }

    const catalogue = await this.getCatalogue(request);
    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const targets = admissionId
      ? await this.admissions.find({
          where: { id: admissionId },
          relations: { patient: true, encounter: true, bed: { ward: true }, ward: true },
        })
      : await this.admissions.find({
          where: [
            { status: 'active' },
            { status: 'discharged', dischargedAt: MoreThanOrEqual(startOfYesterday) },
          ],
          relations: { patient: true, encounter: true, bed: { ward: true }, ward: true },
          take: 400,
        });

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const admission of targets) {
      try {
        const result = await this.processAdmission(admission, catalogue, request?.user?.sub ?? null);
        generated += result.generated;
        skipped += result.skipped;
        errors.push(...result.errors);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Accommodation charge failed';
        errors.push(`${admission.admissionNo}: ${message}`);
        this.logger.warn(`Accommodation charge failed for ${admission.admissionNo}: ${message}`);
      }
    }

    const job = {
      lastRunAt: new Date().toISOString(),
      lastSuccessAt: errors.length === targets.length && targets.length > 0 ? null : new Date().toISOString(),
      lastGenerated: generated,
      lastSkipped: skipped,
      lastErrors: errors.slice(0, 20),
      lastAdmissions: targets.length,
      lastMessage:
        generated === 0 && skipped === 0 && !targets.length
          ? 'No eligible admissions.'
          : generated === 0 && skipped > 0
            ? 'All planned accommodation days already existed or had no configured rate.'
            : null,
    };
    await this.writeJobStatus(job, request);
    return { generated, skipped, errors, admissions: targets.length, message: job.lastMessage };
  }

  async processAdmissionById(admissionId: string, request?: RequestContext) {
    return this.processEligibleAdmissions(request, admissionId);
  }

  async admissionAccount(admissionId: string) {
    const admission = await this.admissions.findOne({
      where: { id: admissionId },
      relations: { patient: true, encounter: true, bed: { ward: true }, ward: true },
    });
    if (!admission) throw new NotFoundException('Admission not found');

    const [transfers, catalogue] = await Promise.all([
      this.transfers.find({
        where: { admission: { id: admissionId } },
        relations: { fromBed: { ward: true }, toBed: { ward: true } },
        order: { createdAt: 'ASC' },
      }),
      this.getCatalogue(),
    ]);

    const planned = planAccommodationCharges({
      admissionId: admission.id,
      admittedAt: admission.admittedAt,
      dischargedAt: admission.dischargedAt,
      currentBed: {
        id: admission.bed.id,
        bedNo: admission.bed.bedNo,
        ward: admission.ward ?? admission.bed.ward,
      },
      transfers: transfers.map((row) => ({
        createdAt: row.createdAt,
        fromBed: {
          id: row.fromBed.id,
          bedNo: row.fromBed.bedNo,
          ward: row.fromBed.ward,
        },
        toBed: {
          id: row.toBed.id,
          bedNo: row.toBed.bedNo,
          ward: row.toBed.ward,
        },
      })),
      catalogue,
    });

    const linkedIds = await this.linkedServiceIds(admission);
    const charges = await this.charges.find({
      where: [
        { patient: { id: admission.patient.id }, serviceLine: 'inpatient' },
        ...(linkedIds.laboratory.length
          ? [{ serviceLine: 'laboratory' as const, serviceEntityId: In(linkedIds.laboratory) }]
          : []),
        ...(linkedIds.radiology.length
          ? [{ serviceLine: 'radiology' as const, serviceEntityId: In(linkedIds.radiology) }]
          : []),
        ...(linkedIds.pharmacy.length
          ? [{ serviceLine: 'pharmacy' as const, serviceEntityId: In(linkedIds.pharmacy) }]
          : []),
      ],
      relations: { encounter: true },
      order: { createdAt: 'ASC' },
      take: 200,
    });

    const forAdmission = charges.filter((charge) => this.chargeBelongsToAdmission(charge, admission, linkedIds));
    const payments = forAdmission.length
      ? await this.transactions.find({
          where: {
            patient: { id: admission.patient.id },
            status: In(['completed', 'initiated']),
            chargeId: In(forAdmission.map((row) => row.id)),
          },
          order: { createdAt: 'ASC' },
          take: 200,
        })
      : [];

    const chargeRows = forAdmission.map((charge) => ({
      id: charge.id,
      date: typeof charge.metadata?.serviceDate === 'string' ? charge.metadata.serviceDate : charge.createdAt,
      charge: charge.serviceDescription,
      quantity: Number(charge.metadata?.quantity ?? 1),
      unitPrice: Number(charge.metadata?.unitPrice ?? charge.amountOwed),
      total: Number(charge.amountOwed),
      paid: Number(charge.amountPaid),
      waived: Number(charge.amountWaived),
      remaining: chargeRemaining(charge),
      source: chargeSourceLabel(charge.metadata, charge.serviceLine),
      status: charge.status,
      serviceLine: charge.serviceLine,
      serviceEntityId: charge.serviceEntityId,
    }));

    const totalCharges = chargeRows.reduce((sum, row) => sum + row.total, 0);
    const totalPaid = chargeRows.reduce((sum, row) => sum + row.paid, 0);
    const totalWaived = chargeRows.reduce((sum, row) => sum + row.waived, 0);
    const outstanding = Math.max(0, totalCharges - totalPaid - totalWaived);
    const accommodation = chargeRows.filter((row) => row.source === 'ACCOMMODATION');
    const currentItem = chargeItemPreview(catalogue, admission.ward?.type ?? admission.bed.ward?.type);

    return {
      admission: {
        id: admission.id,
        admissionNo: admission.admissionNo,
        status: admission.status,
        admittedAt: admission.admittedAt,
        dischargedAt: admission.dischargedAt,
        ward: admission.ward?.name ?? admission.bed.ward?.name,
        wardType: admission.ward?.type ?? admission.bed.ward?.type,
        bed: admission.bed.bedNo,
        patient: {
          id: admission.patient.id,
          patientNo: admission.patient.patientNo,
          name: `${admission.patient.firstName} ${admission.patient.lastName}`,
        },
      },
      stay: {
        admissionDate: admission.admittedAt,
        ward: admission.ward?.name ?? admission.bed.ward?.name,
        bed: admission.bed.bedNo,
        accommodationType: currentItem?.name ?? admission.ward?.type,
        chargeItemCode: currentItem?.code ?? null,
        plannedDays: planned.length,
        transfers: transfers.map((row) => ({
          at: row.createdAt,
          from: `${row.fromBed.ward?.name ?? ''} ${row.fromBed.bedNo}`.trim(),
          to: `${row.toBed.ward?.name ?? ''} ${row.toBed.bedNo}`.trim(),
          reason: row.reason,
        })),
      },
      policy: catalogue.policy,
      charges: chargeRows,
      accommodation,
      services: chargeRows.filter((row) => row.source !== 'ACCOMMODATION'),
      payments: payments.map((row) => ({
        id: row.id,
        date: row.createdAt,
        amount: Number(row.amount ?? 0),
        method: row.method,
        status: row.status,
        reference: row.externalReference,
        chargeId: row.chargeId,
      })),
      byDepartment: groupSum(chargeRows, (row) => row.source, (row) => row.total),
      totals: {
        charges: totalCharges,
        payments: totalPaid,
        waived: totalWaived,
        outstanding,
      },
      missingRates: planned
        .map((day) => catalogue.items.find((item) => item.code === day.chargeItemCode) ?? null)
        .filter((item): item is HospitalChargeItem => {
          if (!item) return false;
          return resolveChargeUnitPrice(item, planned[0]?.serviceDate ?? '') == null;
        })
        .filter((item, index, list) => list.findIndex((row) => row.code === item.code) === index)
        .map((item) => ({ code: item.code, name: item.name })),
    };
  }

  async createManualCharge(
    dto: {
      patientId: string;
      encounterId?: string | null;
      admissionId?: string | null;
      chargeItemCode: string;
      quantity: number;
      unitPrice?: number | null;
      reason: string;
      serviceDate?: string;
    },
    request: RequestContext,
  ) {
    if (!chargesEnabled()) {
      throw new BadRequestException('Operational charges are disabled.');
    }
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const catalogue = await this.getCatalogue(request);
    const item = catalogue.items.find((row) => row.code === dto.chargeItemCode);
    if (!item || !item.active) {
      throw new BadRequestException('Select an active charge catalogue item.');
    }
    const serviceDate = dto.serviceDate ?? new Date().toISOString().slice(0, 10);
    const unitPrice = dto.unitPrice ?? resolveChargeUnitPrice(item, serviceDate);
    if (unitPrice == null || unitPrice <= 0) {
      throw new BadRequestException(
        `No hospital rate is configured for ${item.name}. Enter the authorised price or set it in the charge catalogue first.`,
      );
    }
    const quantity = Number(dto.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.');
    }
    const amount = Math.round(unitPrice * quantity * 100) / 100;
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('A reason / reference is required for a manual charge.');
    }

    let admission: Admission | null = null;
    if (dto.admissionId) {
      admission = await this.admissions.findOne({
        where: { id: dto.admissionId, patient: { id: patient.id } },
        relations: { encounter: true },
      });
      if (!admission) throw new NotFoundException('Admission not found for this patient');
    }

    return this.charges.save(
      this.charges.create({
        patient,
        encounter: dto.encounterId
          ? ({ id: dto.encounterId } as Encounter)
          : admission?.encounter
            ? ({ id: admission.encounter.id } as Encounter)
            : null,
        serviceLine: serviceLineForCategory(item.category),
        serviceEntityId: null,
        serviceDescription: `${item.name} × ${quantity} — ${reason}`,
        amountOwed: String(amount),
        amountPaid: '0',
        amountWaived: '0',
        currency: 'KES',
        status: 'owed',
        metadata: {
          kind: 'manual',
          source: 'MANUAL',
          chargeItemCode: item.code,
          quantity,
          unitPrice,
          serviceDate,
          reason,
          admissionId: admission?.id ?? dto.admissionId ?? null,
        },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async upsertServiceCharge(params: {
    patientId: string;
    encounterId?: string | null;
    admissionId?: string | null;
    serviceLine: PaymentServiceLine;
    serviceEntityId: string;
    description: string;
    amount: number;
    source: string;
    kind: string;
    userId?: string | null;
    extra?: Record<string, unknown>;
  }) {
    if (!chargesEnabled()) return null;
    if (!Number.isFinite(params.amount) || params.amount <= 0) return null;
    if (!params.serviceEntityId) return null;

    const existing = await this.charges.findOne({
      where: {
        serviceLine: params.serviceLine,
        serviceEntityId: params.serviceEntityId,
        status: In(['owed', 'partially_paid', 'paid']),
      },
    });
    if (existing) {
      return existing;
    }

    return this.charges.save(
      this.charges.create({
        patient: { id: params.patientId } as Patient,
        encounter: params.encounterId ? ({ id: params.encounterId } as Encounter) : null,
        serviceLine: params.serviceLine,
        serviceEntityId: params.serviceEntityId,
        serviceDescription: params.description,
        amountOwed: String(params.amount),
        amountPaid: '0',
        amountWaived: '0',
        currency: 'KES',
        status: 'owed',
        metadata: {
          kind: params.kind,
          source: params.source,
          admissionId: params.admissionId ?? null,
          ...(params.extra ?? {}),
        },
        createdBy: params.userId ?? null,
        updatedBy: params.userId ?? null,
      }),
    );
  }

  async financialSummary(scope: 'all' | 'ipd', from?: string, to?: string) {
    const start = from ? new Date(`${from}T00:00:00.000Z`) : startOfToday();
    const end = to ? new Date(`${to}T23:59:59.999Z`) : endOfToday();
    const chargeQb = this.charges
      .createQueryBuilder('charge')
      .where('charge.createdAt BETWEEN :start AND :end', { start, end });
    if (scope === 'ipd') {
      chargeQb.andWhere(
        `(charge.serviceLine = 'inpatient' OR charge.metadata ->> 'admissionId' IS NOT NULL OR charge.metadata ->> 'source' = 'ACCOMMODATION')`,
      );
    }
    const chargeRows = await chargeQb.getMany();
    const paymentQb = this.transactions
      .createQueryBuilder('txn')
      .where('txn.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('txn.status IN (:...statuses)', { statuses: ['completed'] });
    if (scope === 'ipd') {
      paymentQb.andWhere(`(txn.serviceLine = 'inpatient' OR txn.chargeId IN (:...ids))`, {
        ids: chargeRows.length ? chargeRows.map((row) => row.id) : ['00000000-0000-0000-0000-000000000000'],
      });
    }
    const paymentRows = await paymentQb
      .orderBy('txn.createdAt', 'DESC')
      .take(500)
      .getMany();

    const chargesTotal = chargeRows.reduce((sum, row) => sum + Number(row.amountOwed), 0);
    const collected = paymentRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const outstanding = chargeRows.reduce((sum, row) => sum + chargeRemaining(row), 0);
    const accommodation = chargeRows.filter(
      (row) => chargeSourceLabel(row.metadata, row.serviceLine) === 'ACCOMMODATION',
    );

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      scope,
      charges: chargesTotal,
      collections: collected,
      outstanding,
      accommodationCharges: accommodation.reduce((sum, row) => sum + Number(row.amountOwed), 0),
      chargeCount: chargeRows.length,
      paymentCount: paymentRows.length,
      bySource: groupSum(chargeRows, (row) => chargeSourceLabel(row.metadata, row.serviceLine), (row) => Number(row.amountOwed)),
      byPaymentMethod: groupSum(paymentRows, (row) => row.method, (row) => Number(row.amount ?? 0)),
    };
  }

  private async processAdmission(
    admission: Admission,
    catalogue: HospitalChargeCatalogue,
    userId: string | null,
  ) {
    if (admission.status === 'cancelled') {
      return { generated: 0, skipped: 0, errors: [] };
    }
    const transfers = await this.transfers.find({
      where: { admission: { id: admission.id } },
      relations: { fromBed: { ward: true }, toBed: { ward: true } },
      order: { createdAt: 'ASC' },
    });
    const planned = planAccommodationCharges({
      admissionId: admission.id,
      admittedAt: admission.admittedAt,
      dischargedAt: admission.dischargedAt,
      currentBed: {
        id: admission.bed.id,
        bedNo: admission.bed.bedNo,
        ward: admission.ward ?? admission.bed.ward,
      },
      transfers: transfers.map((row) => ({
        createdAt: row.createdAt,
        fromBed: { id: row.fromBed.id, bedNo: row.fromBed.bedNo, ward: row.fromBed.ward },
        toBed: { id: row.toBed.id, bedNo: row.toBed.bedNo, ward: row.toBed.ward },
      })),
      catalogue,
    });

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const day of planned) {
      const item = catalogue.items.find((row) => row.code === day.chargeItemCode);
      if (!item) {
        skipped += 1;
        continue;
      }
      const unitPrice = resolveChargeUnitPrice(item, day.serviceDate);
      if (unitPrice == null) {
        skipped += 1;
        continue;
      }
      const entityId = accommodationChargeEntityId(day.occupancyKey);
      const created = await this.charges.manager.transaction(async (manager) => {
        const repo = manager.getRepository(Charge);
        const existing = await repo
          .createQueryBuilder('charge')
          .setLock('pessimistic_write')
          .where('charge.serviceLine = :line', { line: 'inpatient' })
          .andWhere('charge.serviceEntityId = :entityId', { entityId })
          .andWhere('charge.status IN (:...statuses)', { statuses: ['owed', 'partially_paid', 'paid'] })
          .getOne();
        if (existing) return null;
        return repo.save(
          repo.create({
            patient: { id: admission.patient.id } as Patient,
            encounter: admission.encounter ? ({ id: admission.encounter.id } as Encounter) : null,
            serviceLine: 'inpatient',
            serviceEntityId: entityId,
            serviceDescription: `${item.name} · ${day.wardName} ${day.bedNo} · ${day.serviceDate}`,
            amountOwed: String(unitPrice),
            amountPaid: '0',
            amountWaived: '0',
            currency: 'KES',
            status: 'owed',
            metadata: {
              kind: 'accommodation',
              source: 'ACCOMMODATION',
              admissionId: admission.id,
              admissionNo: admission.admissionNo,
              serviceDate: day.serviceDate,
              chargeItemCode: item.code,
              wardId: day.wardId,
              wardName: day.wardName,
              wardType: day.wardType,
              bedId: day.bedId,
              bedNo: day.bedNo,
              occupancyKey: day.occupancyKey,
              quantity: 1,
              unitPrice,
            },
            createdBy: userId,
            updatedBy: userId,
          }),
        );
      });
      if (created) generated += 1;
      else skipped += 1;
    }

    return { generated, skipped, errors };
  }

  private chargeBelongsToAdmission(
    charge: Charge,
    admission: Admission,
    linked: { laboratory: string[]; radiology: string[]; pharmacy: string[] },
  ) {
    if (charge.metadata?.admissionId === admission.id) return true;
    if (charge.serviceLine === 'inpatient' && charge.metadata?.kind === 'accommodation') {
      return charge.metadata.admissionId === admission.id;
    }
    if (charge.serviceEntityId && linked.laboratory.includes(charge.serviceEntityId)) return true;
    if (charge.serviceEntityId && linked.radiology.includes(charge.serviceEntityId)) return true;
    if (charge.serviceEntityId && linked.pharmacy.includes(charge.serviceEntityId)) return true;
    if (admission.encounter?.id && charge.encounter?.id === admission.encounter.id) return true;
    return false;
  }

  private async linkedServiceIds(admission: Admission) {
    const [labs, radiology, pharmacy] = await Promise.all([
      this.labRequests.find({
        where: [{ admission: { id: admission.id } }, ...(admission.encounter?.id ? [{ encounter: { id: admission.encounter.id } }] : [])],
        select: { id: true },
        take: 200,
      }),
      this.radiologyRequests.find({
        where: [{ admission: { id: admission.id } }, ...(admission.encounter?.id ? [{ encounter: { id: admission.encounter.id } }] : [])],
        select: { id: true },
        take: 200,
      }),
      this.clinicalOrders.find({
        where: {
          orderType: 'pharmacy',
          patient: { id: admission.patient.id },
          admission: { id: admission.id },
        },
        select: { id: true },
        take: 200,
      }),
    ]);
    return {
      laboratory: labs.map((row) => row.id),
      radiology: radiology.map((row) => row.id),
      pharmacy: pharmacy.map((row) => row.id),
    };
  }

  async listCataloguePage(
    request: RequestContext | undefined,
    query: { q?: string; department?: string; review?: string; page?: number; pageSize?: number },
  ) {
    const catalogue = await this.getCatalogue(request);
    const page = paginateCatalogueItems(catalogue.items, query);
    return {
      policy: catalogue.policy,
      oxygen: catalogue.oxygen,
      job: catalogue.job,
      mappingRules: QUICKBOOKS_MAPPING_RULES,
      ...page,
    };
  }

  async previewCatalogueImport(rows: CatalogueImportRow[], request?: RequestContext) {
    const catalogue = await this.getCatalogue(request);
    const preview = previewCatalogueRows(catalogue.items, rows.slice(0, 5000));
    return {
      total: preview.length,
      importable: preview.filter((row) => row.importable).length,
      reviewRequired: preview.filter((row) => !row.importable).length,
      zeroPriced: preview.filter((row) => row.flags.includes('zero_price')).length,
      mappingRules: QUICKBOOKS_MAPPING_RULES,
      rows: preview.slice(0, 200),
    };
  }

  async confirmCatalogueImport(
    rows: CatalogueImportRow[],
    request: RequestContext,
  ) {
    const catalogue = await this.getCatalogue(request);
    const preview = previewCatalogueRows(catalogue.items, rows.slice(0, 5000));
    const accepted = preview.filter((row) => row.importable);
    const incoming: HospitalChargeItem[] = accepted.map((row) =>
      this.normalizeItem({
        code: row.matchedCode || row.row.code || slugCode(row.row.name || 'SERVICE'),
        name: row.row.name || row.matchedCode || 'Unnamed service',
        sourceName: row.row.sourceName || row.row.name,
        sourceItemCode: row.row.sourceItemCode || row.row.code,
        source: 'quickbooks',
        department: row.row.department,
        category: inferCategory(row.row.department, row.row.category, row.row.name),
        chargeType: 'service',
        unit: row.row.unit || 'each',
        unitPrice: row.row.unitPrice ?? null,
        active: true,
        automatic: false,
        recurrence: 'none',
        accounting: {
          account: row.row.account,
          cogsAccount: row.row.cogsAccount,
          assetAccount: row.row.assetAccount,
          vat: row.row.vat,
          supplier: row.row.supplier,
        },
      }),
    );
    return this.saveCatalogue({ items: incoming, policy: catalogue.policy }, request);
  }

  async ipdCensus() {
    const active = await this.admissions.find({
      where: { status: 'active' },
      relations: { patient: true, ward: true, bed: true },
      take: 200,
      order: { admittedAt: 'DESC' },
    });
    const patientIds = active.map((row) => row.patient.id);
    const charges = patientIds.length
      ? await this.charges.find({
          where: { patient: { id: In(patientIds) }, status: In(['owed', 'partially_paid', 'paid']) },
          relations: { patient: true },
          take: 2000,
        })
      : [];
    return active.map((admission) => {
      const scoped = charges.filter((charge) => {
        if (charge.metadata?.admissionId === admission.id) return true;
        if (charge.patient?.id !== admission.patient.id) return false;
        return charge.serviceLine === 'inpatient' || charge.createdAt >= admission.admittedAt;
      });
      const total = scoped.reduce((sum, row) => sum + Number(row.amountOwed), 0);
      const paid = scoped.reduce((sum, row) => sum + Number(row.amountPaid), 0);
      const waived = scoped.reduce((sum, row) => sum + Number(row.amountWaived), 0);
      const days = Math.max(
        1,
        Math.ceil((Date.now() - admission.admittedAt.getTime()) / 86_400_000),
      );
      return {
        admissionId: admission.id,
        patient: `${admission.patient.firstName} ${admission.patient.lastName}`,
        patientNo: admission.patient.patientNo,
        ward: admission.ward?.name,
        bed: admission.bed?.bedNo,
        admittedAt: admission.admittedAt,
        days,
        charges: total,
        paid,
        outstanding: Math.max(0, total - paid - waived),
      };
    });
  }

  async adjustCharge(
    chargeId: string,
    dto: { type: 'waiver' | 'discount' | 'refund'; amount: number; reason: string },
    request: RequestContext,
  ) {
    if (!chargesEnabled()) throw new BadRequestException('Operational charges are disabled.');
    const charge = await this.charges.findOne({ where: { id: chargeId }, relations: { patient: true } });
    if (!charge) throw new NotFoundException('Charge not found');
    const amount = Number(dto.amount);
    const reason = dto.reason.trim();
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Amount must be greater than zero.');
    if (reason.length < 3) throw new BadRequestException('A reason is required.');
    const remaining = chargeRemaining(charge);
    if (dto.type !== 'refund' && amount > remaining) {
      throw new BadRequestException(`Adjustment exceeds remaining balance KES ${remaining}.`);
    }
    if (dto.type === 'refund' && amount > Number(charge.amountPaid)) {
      throw new BadRequestException('Refund cannot exceed the amount already paid on this charge.');
    }
    const adjustment = {
      type: dto.type,
      amount,
      reason,
      at: new Date().toISOString(),
      by: request.user?.sub ?? null,
    };
    if (dto.type === 'refund') {
      charge.amountPaid = String(Number(charge.amountPaid) - amount);
    } else {
      charge.amountWaived = String(Number(charge.amountWaived) + amount);
    }
    charge.status = chargeRemaining(charge) <= 0 ? (Number(charge.amountPaid) > 0 ? 'paid' : 'waived') : 'partially_paid';
    charge.metadata = {
      ...(charge.metadata ?? {}),
      adjustments: [...(Array.isArray(charge.metadata?.adjustments) ? charge.metadata.adjustments : []), adjustment],
    };
    charge.updatedBy = request.user?.sub ?? null;
    await this.charges.save(charge);
    await this.transactions.save(
      this.transactions.create({
        patient: charge.patient,
        encounter: null,
        labRequest: null,
        serviceLine: charge.serviceLine,
        serviceEntityId: charge.serviceEntityId,
        serviceDescription: `${dto.type} · ${charge.serviceDescription}`,
        method: dto.type === 'refund' ? 'waived' : 'waived',
        payerScheme: dto.type,
        amount: String(amount),
        currency: 'KES',
        status: 'completed',
        chargeId: charge.id,
        metadata: { kind: dto.type, reason, originalAmountOwed: charge.amountOwed },
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    return charge;
  }

  async closeCashier(request: RequestContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const txns = await this.transactions.find({
      where: { createdAt: MoreThanOrEqual(today), status: 'completed' },
      take: 500,
    });
    const totals = groupSum(txns, (row) => row.method, (row) => Number(row.amount ?? 0));
    const settings = await this.requireSettings(request);
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    catalog.cashierClose = {
      lastClosedAt: new Date().toISOString(),
      closedBy: request.user?.sub ?? null,
      totals,
      count: txns.length,
    };
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
    return catalog.cashierClose;
  }

  private mergeItems(current: HospitalChargeItem[], incoming: HospitalChargeItem[]) {
    const byCode = new Map(current.map((item) => [item.code, item]));
    for (const item of incoming) {
      if (!item.code) continue;
      byCode.set(item.code, { ...(byCode.get(item.code) ?? {}), ...item });
    }
    return [...byCode.values()];
  }

  private normalizeItem(item: HospitalChargeItem): HospitalChargeItem {
    const fallback = defaultHospitalChargeCatalogue().items.find((row) => row.code === item.code);
    const unitPrice = item.unitPrice == null || item.unitPrice === ('' as never) ? null : Number(item.unitPrice);
    return {
      ...fallback,
      ...item,
      code: String(item.code || fallback?.code || '').trim().toUpperCase(),
      name: item.name || fallback?.name || item.code,
      unitPrice: Number.isFinite(Number(unitPrice)) && Number(unitPrice) > 0 ? Number(unitPrice) : null,
      active: item.active !== false,
      automatic: item.automatic !== false,
      recurrence: item.recurrence === 'daily' ? 'daily' : item.recurrence || fallback?.recurrence || 'none',
    };
  }

  private async writeJobStatus(
    job: HospitalChargeCatalogue['job'],
    request?: RequestContext,
  ) {
    const settings = await this.loadSettings(request);
    if (!settings) return;
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    const current = readHospitalChargeCatalogue(catalog);
    catalog.hospitalCharges = { ...current, job: { ...emptyJobStatus(), ...job } };
    await this.settings.update(settings.id, { clinicalCatalog: catalog as never });
  }

  private async requireSettings(request: RequestContext) {
    const settings = await this.loadSettings(request);
    if (!settings) {
      throw new BadRequestException('Hospital settings are missing — cannot save the charge catalogue.');
    }
    return settings;
  }

  private async loadSettings(request?: RequestContext) {
    const tenantId = request?.tenant?.id;
    if (tenantId) {
      return this.settings.findOne({ where: { tenant: { id: tenantId } } });
    }
    const [row] = await this.settings.find({ take: 1 });
    return row ?? null;
  }
}

function chargeItemPreview(catalogue: HospitalChargeCatalogue, wardType?: string) {
  return catalogue.items.find((item) => (item.wardTypes ?? []).includes(wardType ?? ''))
    ?? catalogue.items.find((item) => item.code === 'ACC-GENERAL')
    ?? null;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function groupSum<T>(rows: T[], key: (row: T) => string, amount: (row: T) => number) {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const name = key(row) || 'other';
    totals[name] = (totals[name] ?? 0) + amount(row);
  }
  return totals;
}

function slugCode(name: string) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return slug || 'SERVICE';
}

function inferCategory(department?: string, category?: string, name?: string): HospitalChargeCategory {
  const text = `${department ?? ''} ${category ?? ''} ${name ?? ''}`.toLowerCase();
  if (text.includes('icu')) return 'icu';
  if (text.includes('hdu')) return 'hdu';
  if (text.includes('lab')) return 'laboratory';
  if (text.includes('radio') || text.includes('x-ray') || text.includes('ct ') || text.includes('ultrasound')) return 'radiology';
  if (text.includes('pharm') || text.includes('drug')) return 'pharmacy';
  if (text.includes('theatre') || text.includes('surg')) return 'theatre';
  if (text.includes('oxygen')) return 'oxygen';
  if (text.includes('ward') || text.includes('accommodation') || text.includes('bed')) return 'accommodation';
  if (text.includes('consult')) return 'consultation';
  if (text.includes('mater')) return 'maternity';
  if (text.includes('dental')) return 'dental';
  if (text.includes('ortho')) return 'orthopaedics';
  if (text.includes('physio')) return 'physiotherapy';
  if (text.includes('endoscop')) return 'endoscopy';
  if (text.includes('oncol')) return 'oncology';
  if (text.includes('ambulance')) return 'ambulance';
  return 'other';
}
