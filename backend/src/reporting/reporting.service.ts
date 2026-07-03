import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository, In, MoreThanOrEqual } from 'typeorm';
import { Appointment } from '../appointments/appointment.entities';
import { CriticalAlert, EmergencyEncounter } from '../emergency/emergency.entities';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Pregnancy } from '../maternity/maternity.entities';
import { Encounter, EncounterDiagnosis } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { Referral } from '../referrals/referral.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';

export interface ReportResult<T> {
  generatedAt: string;
  data: T;
  csv: string;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(EncounterDiagnosis)
    private readonly diagnoses: Repository<EncounterDiagnosis>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(Bed) private readonly beds: Repository<Bed>,
    @InjectRepository(EmergencyEncounter)
    private readonly emergencyEncounters: Repository<EmergencyEncounter>,
    @InjectRepository(CriticalAlert)
    private readonly criticalAlerts: Repository<CriticalAlert>,
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    @InjectRepository(LabRequest)
    private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(RadiologyRequest)
    private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(SurgeryBooking)
    private readonly surgeries: Repository<SurgeryBooking>,
    @InjectRepository(Pregnancy)
    private readonly pregnancies: Repository<Pregnancy>,
    @InjectRepository(Referral)
    private readonly referrals: Repository<Referral>,
  ) {}

  async dashboard() {
    const [
      totalPatients,
      activeOpd,
      activeAdmissions,
      occupiedBeds,
      activeEmergency,
      activeAlerts,
      todayAppointments,
    ] = await Promise.all([
      this.patients.count(),
      this.encounters.count({ where: { type: 'opd', status: 'triaged' } }),
      this.admissions.count({ where: { status: 'active' } }),
      this.beds.count({ where: { status: 'occupied' } }),
      this.emergencyEncounters.count({ where: { status: 'active' } }),
      this.criticalAlerts.count({ where: { acknowledgedAt: IsNull() } }),
      this.appointments.count({
        where: { appointmentDate: new Date().toISOString().slice(0, 10) },
      }),
    ]);

    return {
      totalPatients,
      activeOpd,
      activeAdmissions,
      occupiedBeds,
      activeEmergency,
      activeAlerts,
      todayAppointments,
    };
  }

  async operationsCommandCenter() {
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const [
      totalPatients,
      opdToday,
      activeAdmissions,
      totalBeds,
      occupiedBeds,
      pendingLabs,
      pendingRadiology,
      criticalAlerts,
      activeEmergency,
      maternityActive,
      theatreToday,
      todayAppointments,
    ] = await Promise.all([
      this.patients.count(),
      this.encounters.count({
        where: { type: 'opd', startedAt: MoreThanOrEqual(startOfDay) },
      }),
      this.admissions.count({ where: { status: 'active' } }),
      this.beds.count(),
      this.beds.count({ where: { status: 'occupied' } }),
      this.labRequests.count({
        where: { status: In(['requested', 'sample_collected', 'processing', 'resulted']) },
      }),
      this.radiologyRequests.count({
        where: { status: In(['requested', 'scheduled', 'in_progress']) },
      }),
      this.criticalAlerts.count({ where: { acknowledgedAt: IsNull() } }),
      this.emergencyEncounters.count({ where: { status: 'active' } }),
      this.pregnancies.count({ where: { status: 'active' } }),
      this.surgeries.count({
        where: { scheduledStartAt: MoreThanOrEqual(startOfDay) },
      }),
      this.appointments.count({ where: { appointmentDate: today } }),
    ]);

    const occupancyPct =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      generatedAt: new Date().toISOString(),
      patientsToday: opdToday,
      admissions: activeAdmissions,
      dischargesToday: null,
      occupancy: { occupied: occupiedBeds, total: totalBeds, percent: occupancyPct },
      pendingLabs,
      pendingRadiology,
      criticalPatients: criticalAlerts,
      emergencyCases: activeEmergency,
      maternityCases: maternityActive,
      theatreCases: theatreToday,
      todayAppointments,
      totalPatients,
      revenuePlaceholder: null,
      activeUsers: null,
    };
  }

  async opdSummary(): Promise<ReportResult<unknown>> {
    const encounters = await this.encounters.find({
      where: { type: 'opd' },
      relations: { patient: true },
      take: 1000,
    });
    const byStatus = this.countBy(encounters, (encounter) => encounter.status);
    const byVisitType = this.countBy(
      encounters,
      (encounter) => encounter.visitType ?? 'unknown',
    );
    const data = {
      totalVisits: encounters.length,
      byStatus,
      byVisitType,
    };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalVisits', encounters.length],
      ...Object.entries(byStatus).map(([key, value]) => [`status:${key}`, value]),
      ...Object.entries(byVisitType).map(([key, value]) => [
        `visitType:${key}`,
        value,
      ]),
    ]);
  }

  async admissionsReport(): Promise<ReportResult<unknown>> {
    const admissions = await this.admissions.find({
      relations: { ward: true },
      take: 1000,
    });
    const byWard = this.countBy(
      admissions,
      (admission) => admission.ward?.name ?? 'unknown',
    );
    const byType = this.countBy(admissions, (admission) => admission.type);
    const data = {
      totalAdmissions: admissions.length,
      activeAdmissions: admissions.filter((item) => item.status === 'active').length,
      byWard,
      byType,
    };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalAdmissions', data.totalAdmissions],
      ['activeAdmissions', data.activeAdmissions],
      ...Object.entries(byWard).map(([key, value]) => [`ward:${key}`, value]),
      ...Object.entries(byType).map(([key, value]) => [`type:${key}`, value]),
    ]);
  }

  async dischargesReport(): Promise<ReportResult<unknown>> {
    const discharges = await this.admissions.find({
      where: { status: 'discharged' },
      take: 1000,
    });
    const byCondition = this.countBy(
      discharges,
      (admission) => admission.conditionOnDischarge ?? 'unknown',
    );
    const averageLengthOfStay =
      discharges.reduce(
        (sum, admission) => sum + (admission.lengthOfStayDays ?? 0),
        0,
      ) / Math.max(discharges.length, 1);
    const data = {
      totalDischarges: discharges.length,
      byCondition,
      averageLengthOfStay,
    };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalDischarges', data.totalDischarges],
      ['averageLengthOfStay', averageLengthOfStay.toFixed(2)],
      ...Object.entries(byCondition).map(([key, value]) => [
        `condition:${key}`,
        value,
      ]),
    ]);
  }

  async bedOccupancyReport(): Promise<ReportResult<unknown>> {
    const beds = await this.beds.find({ relations: { ward: true }, take: 2000 });
    const byStatus = this.countBy(beds, (bed) => bed.status);
    const byWard = this.countBy(beds, (bed) => bed.ward?.name ?? 'unknown');
    const occupied = byStatus.occupied ?? 0;
    const occupancyRate = beds.length ? occupied / beds.length : 0;
    const data = {
      totalBeds: beds.length,
      occupied,
      occupancyRate,
      byStatus,
      byWard,
    };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalBeds', beds.length],
      ['occupied', occupied],
      ['occupancyRate', occupancyRate.toFixed(4)],
      ...Object.entries(byStatus).map(([key, value]) => [`status:${key}`, value]),
      ...Object.entries(byWard).map(([key, value]) => [`ward:${key}`, value]),
    ]);
  }

  async emergencyStats(): Promise<ReportResult<unknown>> {
    const emergencies = await this.emergencyEncounters.find({ take: 1000 });
    const byStatus = this.countBy(emergencies, (item) => item.status);
    const byDisposition = this.countBy(
      emergencies,
      (item) => item.disposition ?? 'pending',
    );
    const data = {
      totalEmergencyEncounters: emergencies.length,
      byStatus,
      byDisposition,
    };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalEmergencyEncounters', emergencies.length],
      ...Object.entries(byStatus).map(([key, value]) => [`status:${key}`, value]),
      ...Object.entries(byDisposition).map(([key, value]) => [
        `disposition:${key}`,
        value,
      ]),
    ]);
  }

  async diseaseRegister(): Promise<ReportResult<unknown>> {
    const diagnoses = await this.diagnoses.find({ take: 2000 });
    const rows = Object.entries(
      diagnoses.reduce<Record<string, { code: string; count: number }>>(
        (acc, diagnosis) => {
          const key = diagnosis.description;
          acc[key] = acc[key] ?? {
            code: diagnosis.icd10Code ?? '',
            count: 0,
          };
          acc[key].count += 1;
          return acc;
        },
        {},
      ),
    )
      .map(([description, value]) => ({
        description,
        icd10Code: value.code,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count);

    return this.withCsv(rows, [
      ['icd10Code', 'description', 'count'],
      ...rows.map((row) => [row.icd10Code, row.description, row.count]),
    ]);
  }

  async moh705(): Promise<ReportResult<unknown>> {
    const diseaseRegister = await this.diseaseRegister();
    const data = {
      facilityReport: 'MOH 705 weekly disease surveillance draft',
      generatedAt: new Date().toISOString(),
      diseases: diseaseRegister.data,
    };
    return this.withCsv(data, [
      ['report', 'generatedAt'],
      [data.facilityReport, data.generatedAt],
      [],
      ['icd10Code', 'description', 'count'],
      ...((diseaseRegister.data as Array<{
        icd10Code: string;
        description: string;
        count: number;
      }>).map((row) => [row.icd10Code, row.description, row.count])),
    ]);
  }

  async laboratoryReport(): Promise<ReportResult<unknown>> {
    const requests = await this.labRequests.find({ take: 2000, order: { createdAt: 'DESC' } });
    const byStatus = this.countBy(requests, (r) => r.status);
    const data = { totalRequests: requests.length, byStatus };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalRequests', requests.length],
      ...Object.entries(byStatus).map(([k, v]) => [`status:${k}`, v]),
    ]);
  }

  async theatreReport(): Promise<ReportResult<unknown>> {
    const bookings = await this.surgeries.find({
      relations: { patient: true, procedure: true },
      take: 1000,
      order: { scheduledStartAt: 'DESC' },
    });
    const byStatus = this.countBy(bookings, (b) => b.status);
    const data = { totalBookings: bookings.length, byStatus };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalBookings', bookings.length],
      ...Object.entries(byStatus).map(([k, v]) => [`status:${k}`, v]),
    ]);
  }

  async maternityReport(): Promise<ReportResult<unknown>> {
    const pregnancies = await this.pregnancies.find({ take: 1000 });
    const byStatus = this.countBy(pregnancies, (p) => p.status);
    const data = { totalPregnancies: pregnancies.length, byStatus };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalPregnancies', pregnancies.length],
      ...Object.entries(byStatus).map(([k, v]) => [`status:${k}`, v]),
    ]);
  }

  async referralsReport(): Promise<ReportResult<unknown>> {
    const referrals = await this.referrals.find({
      relations: { patient: true },
      take: 1000,
      order: { createdAt: 'DESC' },
    });
    const byStatus = this.countBy(referrals, (r) => r.status);
    const byType = this.countBy(referrals, (r) => r.type);
    const data = { totalReferrals: referrals.length, byStatus, byType };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalReferrals', referrals.length],
      ...Object.entries(byStatus).map(([k, v]) => [`status:${k}`, v]),
      ...Object.entries(byType).map(([k, v]) => [`type:${k}`, v]),
    ]);
  }

  wrapMohReport<T extends Record<string, unknown>>(data: T): ReportResult<T> {
    const rows: Array<Array<string | number>> = [['field', 'value']];
    if ('lines' in data && Array.isArray(data.lines)) {
      rows.length = 0;
      rows.push(['code', 'condition', 'newCases']);
      for (const line of data.lines as Array<{ code: string; condition: string; newCases: number }>) {
        rows.push([line.code, line.condition, line.newCases]);
      }
    } else if ('groups' in data && Array.isArray(data.groups)) {
      rows.length = 0;
      rows.push(['code', 'section', 'testsDone', 'positiveResults']);
      for (const group of data.groups as Array<{
        code: string
        section: string
        testsDone: number
        positiveResults: number
      }>) {
        rows.push([group.code, group.section, group.testsDone, group.positiveResults]);
      }
    } else if ('workload' in data && data.workload && typeof data.workload === 'object') {
      rows.length = 0;
      rows.push(['metric', 'count']);
      for (const [key, value] of Object.entries(data.workload as Record<string, number>)) {
        rows.push([key, value]);
      }
    } else {
      for (const [key, value] of Object.entries(data)) {
        if (key === 'templateVariables') continue;
        if (typeof value === 'object') continue;
        rows.push([key, String(value)]);
      }
    }
    return this.withCsv(data, rows);
  }

  async icuReport(): Promise<ReportResult<unknown>> {
    const admissions = await this.admissions.find({
      relations: { ward: true },
      take: 1000,
    });
    const criticalCare = admissions.filter((a) =>
      ['icu', 'hdu'].includes(a.ward?.type ?? ''),
    );
    const byWard = this.countBy(criticalCare, (a) => a.ward?.name ?? 'unknown');
    const data = {
      totalCriticalCare: criticalCare.length,
      active: criticalCare.filter((a) => a.status === 'active').length,
      byWard,
    };
    return this.withCsv(data, [
      ['metric', 'value'],
      ['totalCriticalCare', data.totalCriticalCare],
      ['active', data.active],
      ...Object.entries(byWard).map(([k, v]) => [`ward:${k}`, v]),
    ]);
  }

  private countBy<T>(items: T[], selector: (item: T) => string) {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = selector(item);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private withCsv<T>(data: T, rows: Array<Array<string | number>>): ReportResult<T> {
    return {
      generatedAt: new Date().toISOString(),
      data,
      csv: rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n'),
    };
  }
}
