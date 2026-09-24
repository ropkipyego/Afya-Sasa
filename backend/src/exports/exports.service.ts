import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { EmergencyEncounter } from '../emergency/emergency.entities';
import { HduAdmission } from '../hdu/hdu.entities';
import { IcuAdmission } from '../icu/icu.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Pregnancy } from '../maternity/maternity.entities';
import { VitalSigns } from '../nursing/nursing.entities';
import { Encounter } from '../opd/opd.entities';
import { Charge } from '../payments/charge.entities';
import { PaymentTransaction } from '../payments/payment.entities';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import { type ExportColumn, toCsv, toXlsx } from './export-workbook';

export const EXPORT_DATASETS = [
  'opd',
  'laboratory',
  'radiology',
  'pharmacy',
  'ipd',
  'emergency',
  'finance',
  'theatre',
  'maternity',
  'icu',
  'hdu',
  'nursing',
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];

const DATASET_PERMISSIONS: Record<ExportDataset, string[]> = {
  opd: ['encounters:read'],
  laboratory: ['lab_requests:read'],
  radiology: ['radiology_requests:read'],
  pharmacy: ['pharmacy:read'],
  ipd: ['admissions:read'],
  emergency: ['emergency:read'],
  finance: ['payments:read'],
  theatre: ['surgery_bookings:read'],
  maternity: ['pregnancies:read'],
  icu: ['icu_admissions:read'],
  hdu: ['hdu_admissions:read'],
  nursing: ['vitals:read'],
};

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(LabRequest) private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(RadiologyRequest) private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(ClinicalOrder) private readonly clinicalOrders: Repository<ClinicalOrder>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(EmergencyEncounter) private readonly emergencies: Repository<EmergencyEncounter>,
    @InjectRepository(PaymentTransaction) private readonly payments: Repository<PaymentTransaction>,
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(SurgeryBooking) private readonly surgeries: Repository<SurgeryBooking>,
    @InjectRepository(Pregnancy) private readonly pregnancies: Repository<Pregnancy>,
    @InjectRepository(IcuAdmission) private readonly icuAdmissions: Repository<IcuAdmission>,
    @InjectRepository(HduAdmission) private readonly hduAdmissions: Repository<HduAdmission>,
    @InjectRepository(VitalSigns) private readonly vitals: Repository<VitalSigns>,
  ) {}

  assertDatasetAccess(dataset: string, permissions: string[]): asserts dataset is ExportDataset {
    if (!EXPORT_DATASETS.includes(dataset as ExportDataset)) {
      throw new NotFoundException('Unknown export dataset');
    }
    const required = DATASET_PERMISSIONS[dataset as ExportDataset];
    if (!required.some((permission) => permissions.includes(permission))) {
      throw new ForbiddenException('You cannot export this department dataset.');
    }
  }

  async build(params: {
    dataset: ExportDataset;
    format: 'csv' | 'xlsx';
    from?: string;
    to?: string;
    status?: string;
    patientId?: string;
    request: RequestContext;
  }) {
    this.assertDatasetAccess(params.dataset, params.request.user?.permissions ?? []);
    const range = this.dateRange(params.from, params.to);
    const { columns, rows, filename } = await this.rowsFor(params.dataset, {
      range,
      status: params.status,
      patientId: params.patientId,
    });
    const buffer = params.format === 'xlsx' ? toXlsx(columns, rows, params.dataset) : toCsv(columns, rows);
    const mime =
      params.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8';
    return {
      buffer,
      mime,
      filename: `${filename}.${params.format === 'xlsx' ? 'xlsx' : 'csv'}`,
      rowCount: rows.length,
      filters: { from: params.from ?? null, to: params.to ?? null, status: params.status ?? null },
    };
  }

  private dateRange(from?: string, to?: string) {
    const start = from ? new Date(`${from}T00:00:00+03:00`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(`${to}T23:59:59.999+03:00`) : new Date();
    return Between(start, end);
  }

  private async rowsFor(
    dataset: ExportDataset,
    filters: { range: ReturnType<ExportsService['dateRange']>; status?: string; patientId?: string },
  ): Promise<{ columns: ExportColumn[]; rows: Array<Record<string, unknown>>; filename: string }> {
    const take = 5000;
    if (dataset === 'opd') {
      const items = await this.encounters.find({
        where: {
          type: 'opd',
          startedAt: filters.range,
          ...(filters.status ? { status: filters.status as Encounter['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true, attendingDoctor: true },
        order: { startedAt: 'DESC' },
        take,
      });
      return {
        filename: 'opd-visits',
        columns: [
          { key: 'encounterNo', header: 'Encounter' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'phone', header: 'Phone' },
          { key: 'clinic', header: 'Clinic' },
          { key: 'status', header: 'Status' },
          { key: 'doctor', header: 'Doctor' },
          { key: 'startedAt', header: 'Started', kind: 'date' },
        ],
        rows: items.map((row) => ({
          encounterNo: row.encounterNo,
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          phone: row.patient?.primaryPhone,
          clinic: row.departmentName,
          status: row.status,
          doctor: row.attendingDoctor
            ? `${row.attendingDoctor.firstName} ${row.attendingDoctor.lastName}`
            : '',
          startedAt: row.startedAt,
        })),
      };
    }
    if (dataset === 'laboratory') {
      const items = await this.labRequests.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as LabRequest['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'laboratory-requests',
        columns: [
          { key: 'requestNo', header: 'Request' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'status', header: 'Status' },
          { key: 'priority', header: 'Priority' },
          { key: 'paymentStatus', header: 'Payment' },
          { key: 'createdAt', header: 'Created', kind: 'date' },
        ],
        rows: items.map((row) => ({
          requestNo: row.requestNo,
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          status: row.status,
          priority: row.priority,
          paymentStatus: row.paymentStatus,
          createdAt: row.createdAt,
        })),
      };
    }
    if (dataset === 'radiology') {
      const items = await this.radiologyRequests.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as RadiologyRequest['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true, modality: true },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'radiology-requests',
        columns: [
          { key: 'requestNo', header: 'Request' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'modality', header: 'Modality' },
          { key: 'bodyPart', header: 'Body part' },
          { key: 'status', header: 'Status' },
          { key: 'createdAt', header: 'Created', kind: 'date' },
        ],
        rows: items.map((row) => ({
          requestNo: row.requestNo,
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          modality: row.modality?.name,
          bodyPart: row.bodyPart,
          status: row.status,
          createdAt: row.createdAt,
        })),
      };
    }
    if (dataset === 'pharmacy') {
      const items = await this.clinicalOrders.find({
        where: {
          orderType: 'pharmacy',
          orderedAt: filters.range,
          ...(filters.status ? { status: filters.status as ClinicalOrder['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true },
        order: { orderedAt: 'DESC' },
        take,
      });
      return {
        filename: 'pharmacy-orders',
        columns: [
          { key: 'orderNo', header: 'Order' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'medication', header: 'Medication' },
          { key: 'status', header: 'Status' },
          { key: 'orderedAt', header: 'Ordered', kind: 'date' },
        ],
        rows: items.map((row) => ({
          orderNo: row.orderNo,
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          medication: row.metadata?.medication ?? row.orderNo,
          status: row.status,
          orderedAt: row.orderedAt,
        })),
      };
    }
    if (dataset === 'ipd') {
      const items = await this.admissions.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as Admission['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true, ward: true, bed: true },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'ipd-admissions',
        columns: [
          { key: 'admissionNo', header: 'Admission' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'ward', header: 'Ward' },
          { key: 'bed', header: 'Bed' },
          { key: 'status', header: 'Status' },
          { key: 'admittedAt', header: 'Admitted', kind: 'date' },
        ],
        rows: items.map((row) => ({
          admissionNo: row.admissionNo,
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          ward: row.ward?.name,
          bed: row.bed?.bedNo,
          status: row.status,
          admittedAt: row.admittedAt,
        })),
      };
    }
    if (dataset === 'emergency') {
      const items = await this.emergencies.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as EmergencyEncounter['status'] } : {}),
        },
        relations: { encounter: { patient: true } },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'emergency-episodes',
        columns: [
          { key: 'encounterNo', header: 'Encounter' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'triage', header: 'Triage' },
          { key: 'status', header: 'Status' },
          { key: 'stage', header: 'Stage' },
          { key: 'createdAt', header: 'Arrived', kind: 'date' },
        ],
        rows: items
          .filter((row) => !filters.patientId || row.encounter?.patient?.id === filters.patientId)
          .map((row) => ({
            encounterNo: row.encounter?.encounterNo,
            patientNo: row.encounter?.patient?.patientNo,
            patientName: `${row.encounter?.patient?.firstName ?? ''} ${row.encounter?.patient?.lastName ?? ''}`.trim(),
            triage: row.triageCategory,
            status: row.status,
            stage: row.workflowStage,
            createdAt: row.createdAt,
          })),
      };
    }
    if (dataset === 'finance') {
      const items = await this.payments.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as PaymentTransaction['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true },
        order: { createdAt: 'DESC' },
        take,
      });
      const chargeRows = await this.charges.find({
        where: {
          createdAt: filters.range,
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'finance-payments',
        columns: [
          { key: 'kind', header: 'Kind' },
          { key: 'reference', header: 'Reference' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'service', header: 'Service' },
          { key: 'amount', header: 'Amount', kind: 'number' },
          { key: 'status', header: 'Status' },
          { key: 'createdAt', header: 'Created', kind: 'date' },
        ],
        rows: [
          ...items.map((row) => ({
            kind: 'payment',
            reference: row.externalReference,
            patientNo: row.patient?.patientNo,
            patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
            service: row.serviceDescription ?? row.serviceLine,
            amount: row.amount != null ? Number(row.amount) : null,
            status: row.status,
            createdAt: row.createdAt,
          })),
          ...chargeRows.map((row) => ({
            kind: 'charge',
            reference: row.id,
            patientNo: row.patient?.patientNo,
            patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
            service: row.serviceDescription,
            amount: Number(row.amountOwed),
            status: row.status,
            createdAt: row.createdAt,
          })),
        ],
      };
    }
    if (dataset === 'theatre') {
      const items = await this.surgeries.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as SurgeryBooking['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true, procedure: true, theatre: true },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'theatre-bookings',
        columns: [
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'procedure', header: 'Procedure' },
          { key: 'theatre', header: 'Theatre' },
          { key: 'status', header: 'Status' },
          { key: 'scheduledStartAt', header: 'Scheduled', kind: 'date' },
        ],
        rows: items.map((row) => ({
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          procedure: row.procedure?.name,
          theatre: row.theatre?.name,
          status: row.status,
          scheduledStartAt: row.scheduledStartAt,
        })),
      };
    }
    if (dataset === 'maternity') {
      const items = await this.pregnancies.find({
        where: {
          createdAt: filters.range,
          ...(filters.status ? { status: filters.status as Pregnancy['status'] } : {}),
          ...(filters.patientId ? { patient: { id: filters.patientId } } : {}),
        },
        relations: { patient: true },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: 'maternity-pregnancies',
        columns: [
          { key: 'pregnancyNo', header: 'Pregnancy' },
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'status', header: 'Status' },
          { key: 'riskLevel', header: 'Risk' },
          { key: 'createdAt', header: 'Opened', kind: 'date' },
        ],
        rows: items.map((row) => ({
          pregnancyNo: row.pregnancyNo,
          patientNo: row.patient?.patientNo,
          patientName: `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''}`.trim(),
          status: row.status,
          riskLevel: row.riskLevel,
          createdAt: row.createdAt,
        })),
      };
    }
    if (dataset === 'icu' || dataset === 'hdu') {
      const repo = dataset === 'icu' ? this.icuAdmissions : this.hduAdmissions;
      const items = await repo.find({
        where: { createdAt: filters.range },
        relations: { admission: { patient: true } },
        order: { createdAt: 'DESC' },
        take,
      });
      return {
        filename: `${dataset}-admissions`,
        columns: [
          { key: 'patientNo', header: 'Patient no' },
          { key: 'patientName', header: 'Patient' },
          { key: 'status', header: 'Status' },
          { key: 'createdAt', header: 'Admitted', kind: 'date' },
        ],
        rows: items
          .filter((row) => !filters.patientId || row.admission?.patient?.id === filters.patientId)
          .map((row) => ({
            patientNo: row.admission?.patient?.patientNo,
            patientName: `${row.admission?.patient?.firstName ?? ''} ${row.admission?.patient?.lastName ?? ''}`.trim(),
            status: row.status,
            createdAt: row.createdAt,
          })),
      };
    }
    const items = await this.vitals.find({
      where: { createdAt: filters.range },
      relations: { encounter: { patient: true } },
      order: { createdAt: 'DESC' },
      take,
    });
    return {
      filename: 'nursing-vitals',
      columns: [
        { key: 'patientNo', header: 'Patient no' },
        { key: 'patientName', header: 'Patient' },
        { key: 'temperature', header: 'Temp' },
        { key: 'pulse', header: 'Pulse', kind: 'number' },
        { key: 'bp', header: 'BP' },
        { key: 'createdAt', header: 'Recorded', kind: 'date' },
      ],
      rows: items
        .filter((row) => !filters.patientId || row.encounter?.patient?.id === filters.patientId)
        .map((row) => ({
          patientNo: row.encounter?.patient?.patientNo,
          patientName: `${row.encounter?.patient?.firstName ?? ''} ${row.encounter?.patient?.lastName ?? ''}`.trim(),
          temperature: row.temperature,
          pulse: row.pulse,
          bp: row.bpSystolic != null ? `${row.bpSystolic}/${row.bpDiastolic ?? ''}` : '',
          createdAt: row.createdAt,
        })),
    };
  }
}
