import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { seedLabCatalog } from './data/lab-catalog.seed-runner';
import {
  LabDepartment,
  LabReferenceRange,
  LabTestParameter,
  OrderableLabTest,
  SpecimenType,
} from './lab-catalog.entities';
import type { PatientDemographics, ParameterResultInput, SeedReferenceRange } from './lab-catalog.types';
import {
  calculateDerivedResults,
  flagResultsForPatient,
  mapFlagToLegacyResultFlag,
} from './lab-result-engine';

export type EvaluateLabResultsDto = {
  orderableTestCode: string;
  patient: PatientDemographics;
  results: ParameterResultInput[];
};

@Injectable()
export class LabCatalogService {
  constructor(
    @InjectRepository(LabDepartment) private readonly departments: Repository<LabDepartment>,
    @InjectRepository(SpecimenType) private readonly specimens: Repository<SpecimenType>,
    @InjectRepository(OrderableLabTest) private readonly orderableTests: Repository<OrderableLabTest>,
    @InjectRepository(LabTestParameter) private readonly parameters: Repository<LabTestParameter>,
    @InjectRepository(LabReferenceRange) private readonly referenceRanges: Repository<LabReferenceRange>,
  ) {}

  listDepartments() {
    return this.departments.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  listSpecimens() {
    return this.specimens.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  listOrderableTests(includeParameters = false) {
    return this.orderableTests.find({
      where: { active: true },
      relations: includeParameters
        ? {
            department: true,
            specimen: true,
            parameters: { referenceRanges: true },
          }
        : { department: true, specimen: true },
      order: { name: 'ASC' },
    });
  }

  async getOrderableTest(code: string) {
    return this.orderableTests.findOne({
      where: { code, active: true },
      relations: {
        department: true,
        specimen: true,
        parameters: { referenceRanges: true },
      },
    });
  }

  async ensureSeeded() {
    const count = await this.orderableTests.count();
    if (count > 0) return { seeded: false, count };

    const queryRunner = this.orderableTests.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await seedLabCatalog(queryRunner, 'demo');
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return { seeded: true, count: await this.orderableTests.count() };
  }

  async evaluateResults(dto: EvaluateLabResultsDto) {
    const test = await this.getOrderableTest(dto.orderableTestCode);
    if (!test) {
      return { derived: [], flagged: [] };
    }

    const formulas = (test.parameters ?? [])
      .filter((parameter) => parameter.calculatedFormula)
      .map((parameter) => ({
        parameterCode: parameter.code,
        formula: parameter.calculatedFormula!,
      }));

    const derived = calculateDerivedResults(dto.results, formulas, dto.patient);
    const combinedResults = [...dto.results, ...derived.map((item) => ({
      parameterCode: item.parameterCode,
      value: item.value,
    }))];

    const catalog = (test.parameters ?? []).map((parameter) => ({
      parameterCode: parameter.code,
      referenceRanges: (parameter.referenceRanges ?? []).map(mapEntityRange),
    }));

    const flagged = flagResultsForPatient(combinedResults, catalog, dto.patient).map((result) => ({
      ...result,
      legacyFlag: mapFlagToLegacyResultFlag(result.flag),
    }));

    return { derived, flagged };
  }

  async importOrderableCatalog(csv: string, request: RequestContext) {
    const rows = parseCsv(csv);
    if (!rows.length) {
      throw new BadRequestException('CSV is empty or missing a header row.');
    }

    const summary = {
      departmentsCreated: 0,
      specimensCreated: 0,
      testsCreated: 0,
      testsUpdated: 0,
      testsSkipped: 0,
      parametersCreated: 0,
      errors: [] as string[],
    };

    const departmentByCode = new Map(
      (await this.departments.find()).map((row) => [row.code.toUpperCase(), row]),
    );
    const specimenByCode = new Map(
      (await this.specimens.find()).map((row) => [row.code.toUpperCase(), row]),
    );

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const code = (row.code ?? '').trim().toUpperCase();
      const name = (row.name ?? '').trim();
      const departmentCode = (row.department_code ?? row.department ?? '').trim().toUpperCase();
      const specimenCode = (row.specimen_code ?? row.specimen ?? '').trim().toUpperCase();

      if (!code || !name) {
        summary.errors.push(`Line ${line}: code and name are required`);
        continue;
      }
      if (!departmentCode || !specimenCode) {
        summary.errors.push(`Line ${line}: department_code and specimen_code are required`);
        continue;
      }

      try {
        let department = departmentByCode.get(departmentCode);
        if (!department) {
          department = await this.departments.save(
            this.departments.create({
              code: departmentCode,
              name: row.department_name?.trim() || departmentCode,
              active: true,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          departmentByCode.set(departmentCode, department);
          summary.departmentsCreated += 1;
        }

        let specimen = specimenByCode.get(specimenCode);
        if (!specimen) {
          specimen = await this.specimens.save(
            this.specimens.create({
              code: specimenCode,
              name: row.specimen_name?.trim() || specimenCode,
              containerDescription: row.container?.trim() || 'Standard container',
              additive: row.additive?.trim() || null,
              color: row.color?.trim() || null,
              active: true,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          specimenByCode.set(specimenCode, specimen);
          summary.specimensCreated += 1;
        }

        const isPanel = ['true', '1', 'yes', 'panel'].includes(
          (row.is_panel ?? row.record_type ?? 'false').trim().toLowerCase(),
        );
        const tatMinutes = row.standard_tat_minutes
          ? Number(row.standard_tat_minutes)
          : row.tat_minutes
            ? Number(row.tat_minutes)
            : 240;

        let test = await this.orderableTests.findOne({ where: { code } });
        if (test) {
          await this.orderableTests.update(test.id, {
            name,
            department,
            specimen,
            isPanel,
            standardTatMinutes: Number.isFinite(tatMinutes) ? tatMinutes : test.standardTatMinutes,
            active: true,
            updatedBy: request.user?.sub ?? null,
          });
          test = await this.orderableTests.findOneOrFail({ where: { id: test.id } });
          summary.testsUpdated += 1;
        } else {
          test = await this.orderableTests.save(
            this.orderableTests.create({
              name,
              code,
              department,
              specimen,
              isPanel,
              standardTatMinutes: Number.isFinite(tatMinutes) ? tatMinutes : 240,
              active: true,
              legacyPanelId: null,
              createdBy: request.user?.sub ?? null,
              updatedBy: request.user?.sub ?? null,
            }),
          );
          summary.testsCreated += 1;
        }

        const parameterCode = (row.parameter_code ?? '').trim().toUpperCase();
        const parameterName = (row.parameter_name ?? row.parameter ?? '').trim();
        if (parameterCode && parameterName) {
          const existingParam = await this.parameters.findOne({
            where: { orderableTest: { id: test.id }, code: parameterCode },
            relations: { orderableTest: true },
          });
          if (!existingParam) {
            const resultType = (row.result_data_type ?? 'numeric').trim().toLowerCase();
            const param = await this.parameters.save(
              this.parameters.create({
                orderableTest: test,
                code: parameterCode,
                name: parameterName,
                unit: row.unit?.trim() || row.parameter_unit?.trim() || null,
                resultDataType: ['numeric', 'boolean', 'text', 'select_options'].includes(resultType)
                  ? (resultType as 'numeric' | 'boolean' | 'text' | 'select_options')
                  : 'numeric',
                selectOptions: null,
                orderIndex: Number(row.parameter_order ?? row.order_index ?? 1) || 1,
                calculatedFormula: null,
                active: true,
                createdBy: request.user?.sub ?? null,
                updatedBy: request.user?.sub ?? null,
              }),
            );
            summary.parametersCreated += 1;

            const refLow = row.ref_low ?? row.reference_low;
            const refHigh = row.ref_high ?? row.reference_high;
            if (refLow && refHigh) {
              await this.referenceRanges.save(
                this.referenceRanges.create({
                  parameter: param,
                  gender: 'ALL',
                  ageMinDays: null,
                  ageMaxDays: null,
                  rangeLow: refLow,
                  rangeHigh: refHigh,
                  criticalLow: row.critical_low?.trim() || null,
                  criticalHigh: row.critical_high?.trim() || null,
                  normalTextValue: null,
                  createdBy: request.user?.sub ?? null,
                  updatedBy: request.user?.sub ?? null,
                }),
              );
            }
          }
        }
      } catch (error) {
        summary.errors.push(`Line ${line}: ${(error as Error).message}`);
        summary.testsSkipped += 1;
      }
    }

    return summary;
  }
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

function mapEntityRange(range: LabReferenceRange): SeedReferenceRange {
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
