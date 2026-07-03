import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { LabRequest, LabRequestItem, LabResult, LabTest } from '../laboratory/laboratory.entities';
import { Delivery } from '../maternity/maternity.entities';
import { Encounter, EncounterDiagnosis } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { Referral } from '../referrals/referral.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import {
  MOH_705A_LINES,
  MOH_705B_LINES,
  MOH_706_GROUPS,
  ageInYears,
  matchMoh705Line,
} from './moh-reports.data';

export type MohReportPeriod = { year: number; month: number };

@Injectable()
export class MohReportsService {
  constructor(
    @InjectRepository(EncounterDiagnosis)
    private readonly diagnoses: Repository<EncounterDiagnosis>,
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(LabRequest)
    private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(LabRequestItem)
    private readonly labItems: Repository<LabRequestItem>,
    @InjectRepository(LabResult)
    private readonly labResults: Repository<LabResult>,
    @InjectRepository(LabTest)
    private readonly labTests: Repository<LabTest>,
    @InjectRepository(Admission)
    private readonly admissions: Repository<Admission>,
    @InjectRepository(RadiologyRequest)
    private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(SurgeryBooking)
    private readonly surgeries: Repository<SurgeryBooking>,
    @InjectRepository(Referral)
    private readonly referrals: Repository<Referral>,
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
  ) {}

  periodRange(period: MohReportPeriod) {
    const start = new Date(Date.UTC(period.year, period.month - 1, 1));
    const end = new Date(Date.UTC(period.year, period.month, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async moh705a(period: MohReportPeriod, facility?: { name?: string; mohCode?: string }) {
    return this.moh705Report('705A', MOH_705A_LINES, period, true, facility);
  }

  async moh705b(period: MohReportPeriod, facility?: { name?: string; mohCode?: string }) {
    return this.moh705Report('705B', MOH_705B_LINES, period, false, facility);
  }

  private async moh705Report(
    form: '705A' | '705B',
    lines: typeof MOH_705A_LINES,
    period: MohReportPeriod,
    underFive: boolean,
    facility?: { name?: string; mohCode?: string },
  ) {
    const { start, end } = this.periodRange(period);
    const diagnoses = await this.diagnoses.find({
      relations: { encounter: { patient: true } },
      where: { createdAt: Between(start, end) },
      take: 5000,
    });

    const counts = Object.fromEntries(lines.map((line) => [line.code, 0]));
    let totalNewCases = 0;

    for (const diagnosis of diagnoses) {
      const patient = diagnosis.encounter?.patient;
      if (!patient?.dateOfBirth) continue;
      const age = ageInYears(patient.dateOfBirth, diagnosis.createdAt);
      const isUnderFive = age < 5;
      if (underFive !== isUnderFive) continue;
      const lineCode = matchMoh705Line(
        diagnosis.description,
        diagnosis.icd10Code,
        lines,
      );
      counts[lineCode] = (counts[lineCode] ?? 0) + 1;
      totalNewCases += 1;
    }

    const opdEncounters = await this.encounters.find({
      where: {
        type: 'opd',
        startedAt: Between(start, end),
      },
      relations: { patient: true },
    });

    const attendances = opdEncounters.filter((encounter) => {
      const patient = encounter.patient;
      if (!patient?.dateOfBirth) return false;
      const age = ageInYears(patient.dateOfBirth, encounter.startedAt);
      return underFive ? age < 5 : age >= 5;
    });

    const lineRows = lines.map((line) => ({
      code: line.code,
      condition: line.label,
      newCases: counts[line.code] ?? 0,
    }));

    return {
      form: `MOH ${form}`,
      title: underFive
        ? 'Outpatient morbidity summary — under 5 years'
        : 'Outpatient morbidity summary — 5 years and above',
      period: `${period.year}-${String(period.month).padStart(2, '0')}`,
      facilityName: facility?.name ?? '',
      mohFacilityCode: facility?.mohCode ?? '',
      totalNewCases,
      totalAttendances: attendances.length,
      newVisits: attendances.filter((e) => e.visitType === 'new').length,
      reattendances: attendances.filter((e) => e.visitType === 'follow_up').length,
      referralsOut: attendances.filter((e) => Boolean(e.referralReason)).length,
      lines: lineRows,
      templateVariables: {
        facilityName: facility?.name ?? '',
        mohFacilityCode: facility?.mohCode ?? '',
        reportMonth: period.month,
        reportYear: period.year,
        reportPeriod: `${period.year}-${String(period.month).padStart(2, '0')}`,
        totalNewCases,
        totalAttendances: attendances.length,
        lines: lineRows,
      },
    };
  }

  async moh706(period: MohReportPeriod, facility?: { name?: string; mohCode?: string }) {
    const { start, end } = this.periodRange(period);
    const results = await this.labResults.find({
      where: { enteredAt: Between(start, end) },
      relations: { requestItem: { test: { panel: true } } },
      take: 5000,
    });

    const groupCounts = Object.fromEntries(
      MOH_706_GROUPS.map((group) => [group.code, { ...group, testsDone: 0, positive: 0 }]),
    );

    for (const result of results) {
      const test = result.requestItem?.test;
      const category = test?.panel?.category ?? 'biochemistry';
      const group = MOH_706_GROUPS.find((g) =>
        (g.categories as readonly string[]).includes(category),
      );
      const code = group?.code ?? 'BC';
      groupCounts[code].testsDone += 1;
      if (['positive', 'reactive', 'detected'].some((flag) =>
        `${result.flag} ${result.value}`.toLowerCase().includes(flag),
      )) {
        groupCounts[code].positive += 1;
      }
    }

    const requests = await this.labRequests.count({
      where: { createdAt: Between(start, end) },
    });

    const groups = Object.values(groupCounts).map((group) => ({
      code: group.code,
      section: group.label,
      testsDone: group.testsDone,
      positiveResults: group.positive,
    }));

    return {
      form: 'MOH 706',
      title: 'Laboratory services summary',
      period: `${period.year}-${String(period.month).padStart(2, '0')}`,
      facilityName: facility?.name ?? '',
      mohFacilityCode: facility?.mohCode ?? '',
      totalLabRequests: requests,
      totalResultsEntered: results.length,
      groups,
      templateVariables: {
        facilityName: facility?.name ?? '',
        mohFacilityCode: facility?.mohCode ?? '',
        reportMonth: period.month,
        reportYear: period.year,
        reportPeriod: `${period.year}-${String(period.month).padStart(2, '0')}`,
        totalLabRequests: requests,
        totalResultsEntered: results.length,
        groups,
      },
    };
  }

  async moh717(period: MohReportPeriod, facility?: { name?: string; mohCode?: string }) {
    const { start, end } = this.periodRange(period);

    const [
      opdVisits,
      admissions,
      discharges,
      labRequests,
      radiologyExams,
      surgeries,
      referrals,
      deliveries,
    ] = await Promise.all([
      this.encounters.count({ where: { type: 'opd', startedAt: Between(start, end) } }),
      this.admissions.count({ where: { admittedAt: Between(start, end) } }),
      this.admissions.count({
        where: { dischargedAt: Between(start, end), status: In(['discharged']) },
      }),
      this.labRequests.count({ where: { createdAt: Between(start, end) } }),
      this.radiologyRequests.count({ where: { createdAt: Between(start, end) } }),
      this.surgeries.count({ where: { scheduledStartAt: Between(start, end) } }),
      this.referrals.count({ where: { createdAt: Between(start, end) } }),
      this.deliveries.count({ where: { deliveryTime: Between(start, end) } }),
    ]);

    const workload = {
      outpatientVisits: opdVisits,
      admissions,
      discharges,
      laboratoryTests: labRequests,
      radiologyExaminations: radiologyExams,
      theatreProcedures: surgeries,
      referrals,
      deliveries,
    };

    return {
      form: 'MOH 717',
      title: 'Monthly hospital workload report',
      period: `${period.year}-${String(period.month).padStart(2, '0')}`,
      facilityName: facility?.name ?? '',
      mohFacilityCode: facility?.mohCode ?? '',
      workload,
      templateVariables: {
        facilityName: facility?.name ?? '',
        mohFacilityCode: facility?.mohCode ?? '',
        reportMonth: period.month,
        reportYear: period.year,
        reportPeriod: `${period.year}-${String(period.month).padStart(2, '0')}`,
        ...workload,
      },
    };
  }
}
