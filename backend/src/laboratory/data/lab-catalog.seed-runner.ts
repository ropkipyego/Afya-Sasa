import type { QueryRunner } from 'typeorm';
import { KENYA_LAB_CATALOG } from './kenya-lab-catalog.seed';
import type { SeedOrderableTest, SeedParameter } from '../lab-catalog.types';

function sqlString(value: string | undefined | null): string {
  if (value === undefined || value === null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'NULL';
  return String(value);
}

function sqlJson(value: unknown): string {
  if (value === undefined || value === null) return 'NULL';
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

async function insertParameters(
  queryRunner: QueryRunner,
  schema: string,
  test: SeedOrderableTest,
  testId: string,
) {
  if (!test.parameters?.length) return;

  for (const parameter of test.parameters) {
    await insertParameterTree(queryRunner, schema, testId, parameter);
  }
}

async function insertParameterTree(
  queryRunner: QueryRunner,
  schema: string,
  testId: string,
  parameter: SeedParameter,
) {
  const parameterRows = await queryRunner.query(
    `
      INSERT INTO ${schema}.lab_test_parameters
        (lab_test_id, name, code, unit, result_data_type, select_options, order_index, calculated_formula, active)
      VALUES ($1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::jsonb, $7::integer, $8::varchar, true)
      ON CONFLICT (lab_test_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        unit = EXCLUDED.unit,
        result_data_type = EXCLUDED.result_data_type,
        select_options = EXCLUDED.select_options,
        order_index = EXCLUDED.order_index,
        calculated_formula = EXCLUDED.calculated_formula,
        updated_at = now()
      RETURNING id
    `,
    [
      testId,
      parameter.name,
      parameter.code,
      parameter.unit ?? null,
      parameter.resultDataType,
      parameter.selectOptions ? JSON.stringify(parameter.selectOptions) : null,
      parameter.orderIndex,
      parameter.calculatedFormula ?? null,
    ],
  );

  const parameterId = parameterRows[0]?.id as string;
  if (!parameterId || !parameter.referenceRanges.length) return;

  await queryRunner.query(
    `DELETE FROM ${schema}.lab_reference_ranges WHERE parameter_id = $1::uuid`,
    [parameterId],
  );

  for (const range of parameter.referenceRanges) {
    await queryRunner.query(
      `
        INSERT INTO ${schema}.lab_reference_ranges
          (parameter_id, gender, age_min_days, age_max_days, range_low, range_high, critical_low, critical_high, normal_text_value)
        VALUES ($1::uuid, $2::varchar, $3::integer, $4::integer, $5::numeric, $6::numeric, $7::numeric, $8::numeric, $9::varchar)
      `,
      [
        parameterId,
        range.gender,
        range.ageMinDays ?? null,
        range.ageMaxDays ?? null,
        range.rangeLow ?? null,
        range.rangeHigh ?? null,
        range.criticalLow ?? null,
        range.criticalHigh ?? null,
        range.normalTextValue ?? null,
      ],
    );
  }
}

export async function seedLabCatalog(queryRunner: QueryRunner, schema = 'demo'): Promise<void> {
  for (const department of KENYA_LAB_CATALOG.departments) {
    await queryRunner.query(
      `
        INSERT INTO ${schema}.lab_departments (code, name, active)
        VALUES ($1, $2, true)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = true, updated_at = now()
      `,
      [department.code, department.name],
    );
  }

  for (const specimen of KENYA_LAB_CATALOG.specimens) {
    await queryRunner.query(
      `
        INSERT INTO ${schema}.lab_specimen_types
          (code, name, container_description, additive, color, active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          container_description = EXCLUDED.container_description,
          additive = EXCLUDED.additive,
          color = EXCLUDED.color,
          active = true,
          updated_at = now()
      `,
      [
        specimen.code,
        specimen.name,
        specimen.containerDescription,
        specimen.additive ?? null,
        specimen.color ?? null,
      ],
    );
  }

  const departmentRows: Array<{ id: string; code: string }> = await queryRunner.query(
    `SELECT id, code FROM ${schema}.lab_departments`,
  );
  const specimenRows: Array<{ id: string; code: string }> = await queryRunner.query(
    `SELECT id, code FROM ${schema}.lab_specimen_types`,
  );

  const departmentByCode = new Map(departmentRows.map((row) => [row.code, row.id]));
  const specimenByCode = new Map(specimenRows.map((row) => [row.code, row.id]));

  for (const test of KENYA_LAB_CATALOG.orderableTests) {
    const departmentId = departmentByCode.get(test.departmentCode);
    const specimenId = specimenByCode.get(test.specimenCode);
    if (!departmentId || !specimenId) continue;

    const testRows = await queryRunner.query(
      `
        INSERT INTO ${schema}.lab_orderable_tests
          (department_id, specimen_id, name, code, is_panel, standard_tat_minutes, active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (code) DO UPDATE SET
          department_id = EXCLUDED.department_id,
          specimen_id = EXCLUDED.specimen_id,
          name = EXCLUDED.name,
          is_panel = EXCLUDED.is_panel,
          standard_tat_minutes = EXCLUDED.standard_tat_minutes,
          active = true,
          updated_at = now()
        RETURNING id
      `,
      [departmentId, specimenId, test.name, test.code, test.isPanel, test.standardTatMinutes],
    );

    const testId = testRows[0]?.id as string;
    if (testId) await insertParameters(queryRunner, schema, test, testId);
  }
}

export function buildLabCatalogSeedSql(schema = 'demo'): string {
  const statements: string[] = [];
  for (const department of KENYA_LAB_CATALOG.departments) {
    statements.push(
      `INSERT INTO ${schema}.lab_departments (code, name, active) VALUES (${sqlString(department.code)}, ${sqlString(department.name)}, true) ON CONFLICT (code) DO NOTHING;`,
    );
  }
  for (const specimen of KENYA_LAB_CATALOG.specimens) {
    statements.push(
      `INSERT INTO ${schema}.lab_specimen_types (code, name, container_description, additive, color, active) VALUES (${sqlString(specimen.code)}, ${sqlString(specimen.name)}, ${sqlString(specimen.containerDescription)}, ${sqlString(specimen.additive ?? null)}, ${sqlString(specimen.color ?? null)}, true) ON CONFLICT (code) DO NOTHING;`,
    );
  }
  return statements.join('\n');
}
