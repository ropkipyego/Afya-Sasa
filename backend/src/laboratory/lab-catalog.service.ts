import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
