import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository, In, MoreThanOrEqual } from 'typeorm';
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
import { Charge, chargesEnabled } from '../payments/charge.entities';
import { PaymentTransaction } from '../payments/payment.entities';
import { canViewDirectorFinance } from '../common/errors/director-access';
import type { AuthenticatedUserContext } from '../common/request-context';
import { compareAgainstBaseline } from './analytics-intelligence';

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
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactions: Repository<PaymentTransaction>,
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

  async operationsCommandCenter(actor?: AuthenticatedUserContext) {
    const includeFinance = canViewDirectorFinance(actor);
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
      dischargesToday,
      chargesToday,
      collectionsToday,
      outstandingOpen,
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
      this.admissions.count({
        where: { status: 'discharged', dischargedAt: MoreThanOrEqual(startOfDay) },
      }),
      includeFinance
        ? this.sumNumeric(this.charges, 'amountOwed', startOfDay)
        : Promise.resolve(null),
      includeFinance
        ? this.sumNumeric(this.paymentTransactions, 'amount', startOfDay, { status: 'completed' })
        : Promise.resolve(null),
      includeFinance ? this.sumOutstandingCharges() : Promise.resolve(null),
    ]);

    const occupancyPct =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : null;
    const attention = await this.operationalAttention();

    return {
      generatedAt: new Date().toISOString(),
      patientsToday: opdToday,
      admissions: activeAdmissions,
      currentInpatients: activeAdmissions,
      dischargesToday,
      occupancy: {
        occupied: occupiedBeds,
        total: totalBeds,
        percent: occupancyPct,
        available: totalBeds > 0,
      },
      pendingLabs,
      pendingRadiology,
      criticalPatients: criticalAlerts,
      emergencyCases: activeEmergency,
      maternityCases: maternityActive,
      theatreCases: theatreToday,
      todayAppointments,
      totalPatients,
      chargesToday: includeFinance ? chargesToday : null,
      collectionsToday: includeFinance ? collectionsToday : null,
      outstanding: includeFinance ? outstandingOpen : null,
      revenuePlaceholder: null,
      accountingIntegration: 'pending',
      chargesEnabled: chargesEnabled(),
      financeVisible: includeFinance,
      attention,
      activeUsers: null,
    };
  }

  async intelligence(from: string, to: string, actor?: AuthenticatedUserContext) {
    const analytics = await this.executiveAnalytics(from, to, actor);
    const period = `${analytics.range.from} to ${analytics.range.to}`;
    const includeFinance = analytics.financeVisible;
    const findings = [
      compareAgainstBaseline(
        'OPD visits',
        analytics.summary.opdVisits,
        analytics.comparison.opdVisits.previous,
        period,
        'encounters',
      ),
      compareAgainstBaseline(
        'Admissions',
        analytics.summary.admissions,
        analytics.comparison.admissions.previous,
        period,
        'admissions',
      ),
      includeFinance
        ? compareAgainstBaseline(
            'Charges',
            analytics.summary.charges ?? 0,
            analytics.comparison.charges?.previous ?? 0,
            period,
            'charges',
          )
        : null,
      includeFinance
        ? compareAgainstBaseline(
            'Collections',
            analytics.summary.collections ?? 0,
            analytics.comparison.collections?.previous ?? 0,
            period,
            'payment_transactions',
          )
        : null,
      includeFinance
        ? compareAgainstBaseline(
            'Outstanding',
            analytics.summary.outstanding ?? 0,
            analytics.comparison.outstanding?.previous ?? 0,
            period,
            'charges',
          )
        : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row));

    const collections = includeFinance ? analytics.summary.collections ?? 0 : 0;
    const charges = includeFinance ? analytics.summary.charges ?? 0 : 0;
    if (includeFinance && charges > 0 && collections < charges * 0.5) {
      findings.push({
        title: 'Collections are below posted charges',
        detail: `IPD/hospital collections are ${collections} compared with posted charges of ${charges} for ${period}.`,
        metric: 'Collections vs charges',
        current: collections,
        baseline: charges,
        period,
        source: 'charges + payment_transactions',
        severity: 'watch',
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      range: analytics.range,
      readOnly: true,
      findings,
    };
  }

  async executiveAnalytics(from: string, to: string, actor?: AuthenticatedUserContext) {
    const { start, end } = parseIsoDateRange(from, to);
    const includeFinance = canViewDirectorFinance(actor);

    const dayMs = 86_400_000;
    const periodDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / dayMs) + 1,
    );
    const priorEnd = new Date(start.getTime() - 1);
    const priorStart = new Date(priorEnd.getTime() - (periodDays - 1) * dayMs);

    const [
      opdSeries,
      patientSeries,
      admissionSeries,
      dischargeSeries,
      labSeries,
      radiologySeries,
      emergencySeries,
      appointmentSeries,
      surgerySeries,
      referralSeries,
      priorOpd,
      priorPatients,
      priorAdmissions,
      priorDischarges,
      priorLabs,
      priorRadiology,
      priorEmergency,
      opdByVisitType,
      opdByStatus,
      labByStatus,
      radiologyByStatus,
      radiologyByPriority,
      admissionsByType,
      admissionsByWard,
      emergencyByTriage,
      emergencyByDisposition,
    ] = await Promise.all([
      this.dailySeries(this.encounters, 'startedAt', start, end, { type: 'opd' }),
      this.dailySeries(this.patients, 'createdAt', start, end),
      this.dailySeries(this.admissions, 'admittedAt', start, end),
      this.dailySeries(this.admissions, 'dischargedAt', start, end, { status: 'discharged' }),
      this.dailySeries(this.labRequests, 'createdAt', start, end),
      this.dailySeries(this.radiologyRequests, 'createdAt', start, end),
      this.dailySeries(this.emergencyEncounters, 'createdAt', start, end),
      this.dailySeriesByDateColumn(this.appointments, 'appointmentDate', from, to),
      this.dailySeries(this.surgeries, 'scheduledStartAt', start, end),
      this.dailySeries(this.referrals, 'createdAt', start, end),
      this.countBetween(this.encounters, 'startedAt', priorStart, priorEnd, { type: 'opd' }),
      this.countBetween(this.patients, 'createdAt', priorStart, priorEnd),
      this.countBetween(this.admissions, 'admittedAt', priorStart, priorEnd),
      this.countBetween(this.admissions, 'dischargedAt', priorStart, priorEnd, {
        status: 'discharged',
      }),
      this.countBetween(this.labRequests, 'createdAt', priorStart, priorEnd),
      this.countBetween(this.radiologyRequests, 'createdAt', priorStart, priorEnd),
      this.countBetween(this.emergencyEncounters, 'createdAt', priorStart, priorEnd),
      this.groupedCount(this.encounters, 'visitType', 'startedAt', start, end, { type: 'opd' }),
      this.groupedCount(this.encounters, 'status', 'startedAt', start, end, { type: 'opd' }),
      this.groupedCount(this.labRequests, 'status', 'createdAt', start, end),
      this.groupedCount(this.radiologyRequests, 'status', 'createdAt', start, end),
      this.groupedCount(this.radiologyRequests, 'priority', 'createdAt', start, end),
      this.groupedCount(this.admissions, 'type', 'admittedAt', start, end),
      this.groupedJoinCount(
        this.admissions,
        'ward',
        'name',
        'admittedAt',
        start,
        end,
      ),
      this.groupedCount(this.emergencyEncounters, 'triageCategory', 'createdAt', start, end),
      this.groupedCount(this.emergencyEncounters, 'disposition', 'createdAt', start, end),
    ]);

    const totalOpd = this.sumSeries(opdSeries);
    const totalPatients = this.sumSeries(patientSeries);
    const totalAdmissions = this.sumSeries(admissionSeries);
    const totalDischarges = this.sumSeries(dischargeSeries);
    const totalLabs = this.sumSeries(labSeries);
    const totalRadiology = this.sumSeries(radiologySeries);
    const totalEmergency = this.sumSeries(emergencySeries);
    const totalAppointments = this.sumSeries(appointmentSeries);
    const totalSurgeries = this.sumSeries(surgerySeries);
    const totalReferrals = this.sumSeries(referralSeries);

    const [totalBeds, occupiedBeds, currentInpatients, finance, priorFinance, attention] =
      await Promise.all([
        this.beds.count(),
        this.beds.count({ where: { status: 'occupied' } }),
        this.admissions.count({ where: { status: 'active' } }),
        includeFinance
          ? this.financeAnalytics(start, end)
          : Promise.resolve(emptyFinance(start, end)),
        includeFinance
          ? this.financeAnalytics(priorStart, priorEnd)
          : Promise.resolve(emptyFinance(priorStart, priorEnd)),
        this.operationalAttention(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      range: { from, to, days: periodDays },
      comparisonRange: {
        from: priorStart.toISOString().slice(0, 10),
        to: priorEnd.toISOString().slice(0, 10),
      },
      financeVisible: includeFinance,
      chargesEnabled: chargesEnabled(),
      accountingIntegration: 'pending' as const,
      attention,
      summary: {
        opdVisits: totalOpd,
        newPatients: totalPatients,
        admissions: totalAdmissions,
        discharges: totalDischarges,
        currentInpatients,
        labRequests: totalLabs,
        radiologyRequests: totalRadiology,
        emergencyCases: totalEmergency,
        appointments: totalAppointments,
        surgeries: totalSurgeries,
        referrals: totalReferrals,
        avgDailyOpd: Math.round((totalOpd / periodDays) * 10) / 10,
        bedOccupancyPercent:
          totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : null,
        occupiedBeds,
        totalBeds,
        charges: includeFinance ? finance.charges : null,
        collections: includeFinance ? finance.collections : null,
        outstanding: includeFinance ? finance.outstanding : null,
        accommodationCharges: includeFinance ? finance.accommodationCharges : null,
      },
      comparison: {
        opdVisits: this.compareDelta(totalOpd, priorOpd),
        newPatients: this.compareDelta(totalPatients, priorPatients),
        admissions: this.compareDelta(totalAdmissions, priorAdmissions),
        discharges: this.compareDelta(totalDischarges, priorDischarges),
        labRequests: this.compareDelta(totalLabs, priorLabs),
        radiologyRequests: this.compareDelta(totalRadiology, priorRadiology),
        emergencyCases: this.compareDelta(totalEmergency, priorEmergency),
        charges: includeFinance
          ? this.compareDelta(finance.charges, priorFinance.charges)
          : null,
        collections: includeFinance
          ? this.compareDelta(finance.collections, priorFinance.collections)
          : null,
        outstanding: includeFinance
          ? this.compareDelta(finance.outstanding, priorFinance.outstanding)
          : null,
      },
      trends: {
        opdVisits: opdSeries,
        newPatients: patientSeries,
        admissions: admissionSeries,
        discharges: dischargeSeries,
        labRequests: labSeries,
        radiologyRequests: radiologySeries,
        emergencyCases: emergencySeries,
        appointments: appointmentSeries,
        surgeries: surgerySeries,
        referrals: referralSeries,
        collections: includeFinance ? finance.collectionSeries : [],
        charges: includeFinance ? finance.chargeSeries : [],
      },
      breakdowns: {
        opdByVisitType,
        opdByStatus,
        labByStatus,
        radiologyByStatus,
        radiologyByPriority,
        admissionsByType,
        admissionsByWard,
        emergencyByTriage,
        emergencyByDisposition,
        chargesByServiceLine: includeFinance ? finance.chargesByServiceLine : {},
        collectionsByMethod: includeFinance ? finance.collectionsByMethod : {},
        outstandingAgeing: includeFinance ? finance.outstandingAgeing : {},
      },
    };
  }

  private async financeAnalytics(start: Date, end: Date) {
    const [
      charges,
      collections,
      outstanding,
      accommodationCharges,
      chargeSeriesRaw,
      collectionSeriesRaw,
      chargesByServiceLine,
      collectionsByMethod,
      ageingRaw,
    ] = await Promise.all([
      this.sumNumericBetween(this.charges, 'amountOwed', start, end),
      this.sumNumericBetween(this.paymentTransactions, 'amount', start, end, {
        status: 'completed',
      }),
      this.sumOutstandingCharges(),
      this.sumAccommodationCharges(start, end),
      this.dailySumSeries(this.charges, 'amountOwed', start, end),
      this.dailySumSeries(this.paymentTransactions, 'amount', start, end, {
        status: 'completed',
      }),
      this.groupedSum(this.charges, 'serviceLine', 'amountOwed', start, end),
      this.groupedSum(this.paymentTransactions, 'method', 'amount', start, end, {
        status: 'completed',
      }),
      this.outstandingAgeing(),
    ]);
    return {
      charges,
      collections,
      outstanding,
      accommodationCharges,
      chargeSeries: chargeSeriesRaw,
      collectionSeries: collectionSeriesRaw,
      chargesByServiceLine,
      collectionsByMethod,
      outstandingAgeing: ageingRaw,
    };
  }

  async operationalAttention() {
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const [
      unassignedOpd,
      waitingForDoctor,
      pendingLabVerification,
      pendingRadiologyReports,
      pendingDischargeSummaries,
      bedConflicts,
    ] = await Promise.all([
      this.encounters
        .createQueryBuilder('encounter')
        .where('encounter.type = :type', { type: 'opd' })
        .andWhere('encounter.status IN (:...statuses)', {
          statuses: ['waiting', 'triaged', 'in_consultation'],
        })
        .andWhere('encounter.attending_doctor_id IS NULL')
        .getCount(),
      this.encounters.count({
        where: { type: 'opd', status: In(['waiting', 'triaged']) },
      }),
      this.labRequests.count({ where: { status: 'resulted' } }),
      this.radiologyRequests.count({
        where: { status: In(['requested', 'scheduled', 'in_progress']) },
      }),
      this.countPendingDischargeSummaries(),
      this.countConflictingBeds(),
    ]);

    return {
      unassignedOpd,
      waitingForDoctor,
      pendingLabVerification,
      pendingRadiologyReports,
      pendingDischarge: pendingDischargeSummaries,
      bedConflicts: bedConflicts,
      failedIntegrations: null,
      biometricDeviceStatus: 'NOT_VERIFIED',
      notificationFailures: null,
      asOf: startOfDay.toISOString(),
    };
  }

  private rollupDaily<T extends { createdAt: Date }>(
    rows: T[],
    amount: (row: T) => number,
    start: Date,
    end: Date,
  ) {
    const days: Record<string, number> = {};
    for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
      days[cursor.toISOString().slice(0, 10)] = 0;
    }
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (key in days) days[key] += amount(row);
    }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }

  private async sumNumeric(
    repository: Repository<object>,
    column: string,
    since: Date,
    filters: Record<string, string> = {},
  ) {
    const alias = 'row';
    const qb = repository
      .createQueryBuilder(alias)
      .select(`COALESCE(SUM((${alias}.${column})::numeric), 0)`, 'total')
      .where(`${alias}.createdAt >= :since`, { since });
    for (const [key, value] of Object.entries(filters)) {
      qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
    }
    const raw = await qb.getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async sumOutstandingCharges() {
    const raw = await this.charges
      .createQueryBuilder('charge')
      .select(
        `COALESCE(SUM((charge.amountOwed)::numeric - (charge.amountPaid)::numeric - (charge.amountWaived)::numeric), 0)`,
        'total',
      )
      .where('charge.status IN (:...statuses)', { statuses: ['owed', 'partially_paid'] })
      .getRawOne<{ total: string }>();
    return Math.max(0, Number(raw?.total ?? 0));
  }

  private async dailySeries(
    repository: Repository<object>,
    column: string,
    start: Date,
    end: Date,
    filters: Record<string, string> = {},
  ) {
    const alias = 'row';
    const qb = repository.createQueryBuilder(alias);
    qb.select(`DATE(${alias}.${column})`, 'day')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.${column} BETWEEN :start AND :end`, { start, end });
    for (const [key, value] of Object.entries(filters)) {
      qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
    }
    qb.groupBy(`DATE(${alias}.${column})`).orderBy('day', 'ASC');
    const rows = await qb.getRawMany<{ day: string; count: string }>();
    return this.fillDailySeries(
      start,
      end,
      rows.map((row) => ({
        date: this.formatDay(row.day),
        count: Number(row.count),
      })),
    );
  }

  private async dailySeriesByDateColumn(
    repository: Repository<{ appointmentDate: string }>,
    column: 'appointmentDate',
    from: string,
    to: string,
  ) {
    const rows = await repository
      .createQueryBuilder('row')
      .select(`row.${column}`, 'day')
      .addSelect('COUNT(*)', 'count')
      .where(`row.${column} BETWEEN :from AND :to`, { from, to })
      .groupBy(`row.${column}`)
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    return this.fillDailySeries(
      start,
      end,
      rows.map((row) => ({
        date: this.formatDay(row.day),
        count: Number(row.count),
      })),
    );
  }

  private async countBetween(
    repository: Repository<object>,
    column: string,
    start: Date,
    end: Date,
    filters: Record<string, string> = {},
  ) {
    const where: Record<string, unknown> = {
      [column]: Between(start, end),
      ...filters,
    };
    return repository.count({ where: where as never });
  }

  private fillDailySeries(
    start: Date,
    end: Date,
    points: Array<{ date: string; count: number }>,
  ) {
    const byDate = new Map(points.map((point) => [point.date, point.count]));
    const series: Array<{ date: string; count: number }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      series.push({ date, count: byDate.get(date) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return series;
  }

  private sumSeries(series: Array<{ count: number }>) {
    return series.reduce((sum, point) => sum + point.count, 0);
  }

  private compareDelta(current: number, previous: number) {
    const delta = current - previous;
    const percent =
      previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
    return { current, previous, delta, percent };
  }

  private formatDay(value: string | Date) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
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

  private async groupedCount(
    repository: Repository<object>,
    column: string,
    dateColumn: string,
    start: Date,
    end: Date,
    filters: Record<string, string> = {},
  ) {
    const alias = 'row';
    const qb = repository
      .createQueryBuilder(alias)
      .select(`COALESCE(${alias}.${column}, 'unknown')`, 'key')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.${dateColumn} BETWEEN :start AND :end`, { start, end });
    for (const [key, value] of Object.entries(filters)) {
      qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
    }
    qb.groupBy(`COALESCE(${alias}.${column}, 'unknown')`);
    const rows = await qb.getRawMany<{ key: string; count: string }>();
    return Object.fromEntries(rows.map((row) => [row.key || 'unknown', Number(row.count)]));
  }

  private async groupedJoinCount(
    repository: Repository<object>,
    relation: string,
    relationColumn: string,
    dateColumn: string,
    start: Date,
    end: Date,
  ) {
    const rows = await repository
      .createQueryBuilder('row')
      .leftJoin(`row.${relation}`, 'joined')
      .select(`COALESCE(joined.${relationColumn}, 'unknown')`, 'key')
      .addSelect('COUNT(*)', 'count')
      .where(`row.${dateColumn} BETWEEN :start AND :end`, { start, end })
      .groupBy(`COALESCE(joined.${relationColumn}, 'unknown')`)
      .getRawMany<{ key: string; count: string }>();
    return Object.fromEntries(rows.map((row) => [row.key || 'unknown', Number(row.count)]));
  }

  private async groupedSum(
    repository: Repository<object>,
    column: string,
    amountColumn: string,
    start: Date,
    end: Date,
    filters: Record<string, string> = {},
  ) {
    const alias = 'row';
    const qb = repository
      .createQueryBuilder(alias)
      .select(`COALESCE(${alias}.${column}, 'unknown')`, 'key')
      .addSelect(`COALESCE(SUM((${alias}.${amountColumn})::numeric), 0)`, 'total')
      .where(`${alias}.createdAt BETWEEN :start AND :end`, { start, end });
    for (const [key, value] of Object.entries(filters)) {
      qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
    }
    qb.groupBy(`COALESCE(${alias}.${column}, 'unknown')`);
    const rows = await qb.getRawMany<{ key: string; total: string }>();
    return Object.fromEntries(rows.map((row) => [row.key || 'unknown', Number(row.total)]));
  }

  private async sumNumericBetween(
    repository: Repository<object>,
    column: string,
    start: Date,
    end: Date,
    filters: Record<string, string> = {},
  ) {
    const alias = 'row';
    const qb = repository
      .createQueryBuilder(alias)
      .select(`COALESCE(SUM((${alias}.${column})::numeric), 0)`, 'total')
      .where(`${alias}.createdAt BETWEEN :start AND :end`, { start, end });
    for (const [key, value] of Object.entries(filters)) {
      qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
    }
    const raw = await qb.getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async dailySumSeries(
    repository: Repository<object>,
    column: string,
    start: Date,
    end: Date,
    filters: Record<string, string> = {},
  ) {
    const alias = 'row';
    const qb = repository
      .createQueryBuilder(alias)
      .select(`DATE(${alias}.createdAt)`, 'day')
      .addSelect(`COALESCE(SUM((${alias}.${column})::numeric), 0)`, 'count')
      .where(`${alias}.createdAt BETWEEN :start AND :end`, { start, end });
    for (const [key, value] of Object.entries(filters)) {
      qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
    }
    qb.groupBy(`DATE(${alias}.createdAt)`).orderBy('day', 'ASC');
    const rows = await qb.getRawMany<{ day: string; count: string }>();
    return this.fillDailySeries(
      start,
      end,
      rows.map((row) => ({
        date: this.formatDay(row.day),
        count: Number(row.count),
      })),
    );
  }

  private async sumAccommodationCharges(start: Date, end: Date) {
    const raw = await this.charges
      .createQueryBuilder('charge')
      .select('COALESCE(SUM((charge.amountOwed)::numeric), 0)', 'total')
      .where('charge.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere(
        `(charge.serviceLine = 'inpatient' OR charge.metadata ->> 'source' = 'ACCOMMODATION')`,
      )
      .getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async countPendingDischargeSummaries() {
    try {
      const rows = (await this.admissions.query(
        `SELECT COUNT(*)::int AS count
         FROM demo.discharge_summaries summary
         INNER JOIN demo.admissions admission ON admission.id = summary.admission_id
         WHERE admission.status = 'active'
           AND summary.status = 'draft'
           AND summary.deleted_at IS NULL
           AND admission.deleted_at IS NULL`,
      )) as Array<{ count: number }>;
      return Number(rows[0]?.count ?? 0);
    } catch {
      return null;
    }
  }

  private async countConflictingBeds() {
    try {
      const rows = (await this.admissions.query(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT admission.bed_id
           FROM demo.admissions admission
           WHERE admission.status = 'active'
             AND admission.deleted_at IS NULL
             AND admission.bed_id IS NOT NULL
           GROUP BY admission.bed_id
           HAVING COUNT(*) > 1
         ) conflicts`,
      )) as Array<{ count: number }>;
      return Number(rows[0]?.count ?? 0);
    } catch {
      return null;
    }
  }

  private async outstandingAgeing() {
    const rows = await this.charges
      .createQueryBuilder('charge')
      .select(
        `CASE
          WHEN EXTRACT(DAY FROM (NOW() - charge.createdAt)) <= 30 THEN '0-30 days'
          WHEN EXTRACT(DAY FROM (NOW() - charge.createdAt)) <= 60 THEN '31-60 days'
          WHEN EXTRACT(DAY FROM (NOW() - charge.createdAt)) <= 90 THEN '61-90 days'
          ELSE '90+ days'
        END`,
        'bucket',
      )
      .addSelect(
        `COALESCE(SUM((charge.amountOwed)::numeric - (charge.amountPaid)::numeric - (charge.amountWaived)::numeric), 0)`,
        'total',
      )
      .where('charge.status IN (:...statuses)', { statuses: ['owed', 'partially_paid'] })
      .groupBy('bucket')
      .getRawMany<{ bucket: string; total: string }>();
    const ageing = { '0-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
    for (const row of rows) {
      if (row.bucket in ageing) ageing[row.bucket as keyof typeof ageing] = Number(row.total);
    }
    return ageing;
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

export function parseIsoDateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new BadRequestException('Invalid date range. Use ISO dates (YYYY-MM-DD).');
  }
  return { start, end };
}

function emptyFinance(start: Date, end: Date) {
  const emptySeries = [] as Array<{ date: string; count: number }>;
  const cursor = new Date(start);
  while (cursor <= end) {
    emptySeries.push({ date: cursor.toISOString().slice(0, 10), count: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    charges: 0,
    collections: 0,
    outstanding: 0,
    accommodationCharges: 0,
    chargeSeries: emptySeries,
    collectionSeries: emptySeries,
    chargesByServiceLine: {} as Record<string, number>,
    collectionsByMethod: {} as Record<string, number>,
    outstandingAgeing: { '0-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 },
  };
}
