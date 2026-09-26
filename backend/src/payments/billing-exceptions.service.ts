import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import { Charge } from './charge.entities';
import { AccommodationChargeService } from './accommodation-charge.service';
import { classifyZeroPrice, resolveChargeUnitPrice } from './hospital-charges';

export type BillingException = {
  kind: 'missed_charge' | 'unpriced_service';
  reason: string;
  patient?: string;
  patientNo?: string;
  source: string;
  sourceId: string;
  expectedService: string;
  action: string;
};

@Injectable()
export class BillingExceptionsService {
  constructor(
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(LabRequest) private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(RadiologyRequest) private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(ClinicalOrder) private readonly clinicalOrders: Repository<ClinicalOrder>,
    @InjectRepository(SurgeryBooking) private readonly surgeries: Repository<SurgeryBooking>,
    private readonly accommodation: AccommodationChargeService,
  ) {}

  async listExceptions() {
    const [labs, radiology, pharmacy, theatre, active, catalogue] = await Promise.all([
      this.labRequests.find({
        where: { status: In(['verified', 'resulted']) },
        relations: { patient: true },
        take: 80,
        order: { createdAt: 'DESC' },
      }),
      this.radiologyRequests.find({
        where: { status: In(['reported', 'reviewed']) },
        relations: { patient: true, modality: true },
        take: 80,
        order: { createdAt: 'DESC' },
      }),
      this.clinicalOrders.find({
        where: { orderType: 'pharmacy', status: In(['dispensed', 'partially_dispensed']) },
        relations: { patient: true },
        take: 80,
        order: { completedAt: 'DESC' },
      }),
      this.surgeries.find({
        where: { status: 'completed' },
        relations: { patient: true, procedure: true },
        take: 80,
        order: { actualEndAt: 'DESC' },
      }),
      this.admissions.find({
        where: { status: 'active' },
        relations: { patient: true, ward: true },
        take: 80,
      }),
      this.accommodation.getCatalogue(),
    ]);

    const chargeKeys = new Set(
      (
        await this.charges.find({
          where: { status: In(['owed', 'partially_paid', 'paid']) },
          take: 2000,
        })
      ).flatMap((charge) => [charge.serviceEntityId, charge.metadata?.admissionId].filter(Boolean)),
    );

    const exceptions: BillingException[] = [];

    for (const row of labs) {
      if (chargeKeys.has(row.id)) continue;
      const amount = Number(row.billingAmount);
      exceptions.push({
        kind: amount > 0 ? 'missed_charge' : 'unpriced_service',
        reason: amount > 0 ? 'Verified laboratory service has no operational charge' : 'Laboratory service has no configured price',
        patient: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : undefined,
        patientNo: row.patient?.patientNo,
        source: 'laboratory',
        sourceId: row.id,
        expectedService: row.requestNo,
        action: amount > 0 ? 'Review and post from the source lab request' : 'Set the hospital lab price first',
      });
    }

    for (const row of radiology) {
      if (chargeKeys.has(row.id)) continue;
      exceptions.push({
        kind: 'missed_charge',
        reason: 'Completed radiology study has no operational charge',
        patient: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : undefined,
        patientNo: row.patient?.patientNo,
        source: 'radiology',
        sourceId: row.id,
        expectedService: `${row.modality?.name ?? 'Imaging'} ${row.requestNo}`,
        action: 'Confirm the study price, then post from the completed request',
      });
    }

    for (const row of pharmacy) {
      if (row.metadata?.kind === 'prescription') continue;
      if (chargeKeys.has(row.id)) continue;
      exceptions.push({
        kind: 'missed_charge',
        reason: 'Dispensed pharmacy item has no operational charge',
        patient: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : undefined,
        patientNo: row.patient?.patientNo,
        source: 'pharmacy',
        sourceId: row.id,
        expectedService: String(row.metadata?.dispensedItemName ?? row.metadata?.medication ?? row.orderNo),
        action: 'Confirm the inventory sell price, then post from the dispense',
      });
    }

    for (const row of theatre) {
      if (chargeKeys.has(row.id)) continue;
      exceptions.push({
        kind: 'missed_charge',
        reason: 'Completed theatre procedure has no operational charge',
        patient: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : undefined,
        patientNo: row.patient?.patientNo,
        source: 'theatre',
        sourceId: row.id,
        expectedService: row.procedure?.name ?? row.bookingNo,
        action: 'Set the procedure tariff, then post from the completed booking',
      });
    }

    const accommodationItems = catalogue.items.filter((item) => item.chargeType === 'accommodation');
    for (const admission of active) {
      if (chargeKeys.has(admission.id)) continue;
      const item = accommodationItems.find((row) => (row.wardTypes ?? []).includes(admission.ward?.type ?? ''));
      const priced = item ? resolveChargeUnitPrice(item, new Date().toISOString().slice(0, 10)) : null;
      exceptions.push({
        kind: priced ? 'missed_charge' : 'unpriced_service',
        reason: priced
          ? 'Active admission has no accommodation charge yet'
          : 'Accommodation rate is not configured for this ward',
        patient: `${admission.patient.firstName} ${admission.patient.lastName}`,
        patientNo: admission.patient.patientNo,
        source: 'ipd',
        sourceId: admission.id,
        expectedService: item?.name ?? `${admission.ward?.name ?? 'Ward'} accommodation`,
        action: priced ? 'Run the accommodation charge job' : 'Enter the hospital ward rate',
      });
    }

    const unpriced = catalogue.items
      .filter((item) => classifyZeroPrice(item) === 'requires_hospital_price' && item.active)
      .slice(0, 40)
      .map((item) => ({
        kind: 'unpriced_service' as const,
        reason: 'Configured service has no hospital price',
        source: 'catalogue',
        sourceId: item.code,
        expectedService: item.name,
        action: 'Classify as priced, non-billable, workflow-derived, or inactive',
      }));

    return {
      generatedAt: new Date().toISOString(),
      count: exceptions.length + unpriced.length,
      exceptions: [...exceptions, ...unpriced].slice(0, 120),
    };
  }
}
