import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedLabCatalog } from '../../laboratory/data/lab-catalog.seed-runner';

export class LabCatalogArchitecture1767800000000 implements MigrationInterface {
  name = 'LabCatalogArchitecture1767800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.lab_departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.lab_specimen_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        container_description varchar NOT NULL,
        additive varchar,
        color varchar,
        active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.lab_orderable_tests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        department_id uuid NOT NULL REFERENCES demo.lab_departments(id),
        specimen_id uuid NOT NULL REFERENCES demo.lab_specimen_types(id),
        name varchar NOT NULL,
        code varchar NOT NULL UNIQUE,
        is_panel boolean NOT NULL DEFAULT false,
        standard_tat_minutes integer NOT NULL DEFAULT 240,
        active boolean NOT NULL DEFAULT true,
        legacy_panel_id uuid REFERENCES demo.lab_panels(id),
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.lab_test_parameters (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        lab_test_id uuid NOT NULL REFERENCES demo.lab_orderable_tests(id) ON DELETE CASCADE,
        name varchar NOT NULL,
        code varchar NOT NULL,
        unit varchar,
        result_data_type varchar NOT NULL,
        select_options jsonb,
        order_index integer NOT NULL DEFAULT 0,
        calculated_formula varchar,
        active boolean NOT NULL DEFAULT true,
        legacy_test_id uuid REFERENCES demo.lab_tests(id),
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        UNIQUE (lab_test_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.lab_reference_ranges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        parameter_id uuid NOT NULL REFERENCES demo.lab_test_parameters(id) ON DELETE CASCADE,
        gender varchar NOT NULL,
        age_min_days integer,
        age_max_days integer,
        range_low numeric,
        range_high numeric,
        critical_low numeric,
        critical_high numeric,
        normal_text_value varchar,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_orderable_tests_department
      ON demo.lab_orderable_tests (department_id, active)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_test_parameters_order
      ON demo.lab_test_parameters (lab_test_id, order_index)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_reference_ranges_parameter
      ON demo.lab_reference_ranges (parameter_id, gender)
    `);

    await queryRunner.query(`
      ALTER TABLE demo.lab_request_items
        ADD COLUMN IF NOT EXISTS orderable_test_id uuid REFERENCES demo.lab_orderable_tests(id)
    `);
    await queryRunner.query(`
      ALTER TABLE demo.lab_results
        ADD COLUMN IF NOT EXISTS parameter_id uuid REFERENCES demo.lab_test_parameters(id)
    `);

    await seedLabCatalog(queryRunner, 'demo');

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.seed_tenant_rbac(source_schema text, dest_schema text)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF source_schema !~ '^[a-z][a-z0-9_]*$' OR dest_schema !~ '^[a-z][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid schema name';
        END IF;

        EXECUTE format(
          'INSERT INTO %I.roles SELECT * FROM %I.roles',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.permissions SELECT * FROM %I.permissions',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.role_permissions SELECT * FROM %I.role_permissions',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.departments SELECT * FROM %I.departments',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_departments SELECT * FROM %I.lab_departments',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_specimen_types SELECT * FROM %I.lab_specimen_types',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_orderable_tests SELECT * FROM %I.lab_orderable_tests',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_test_parameters SELECT * FROM %I.lab_test_parameters',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_reference_ranges SELECT * FROM %I.lab_reference_ranges',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_panels SELECT * FROM %I.lab_panels',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_tests SELECT * FROM %I.lab_tests',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.radiology_modalities SELECT * FROM %I.radiology_modalities',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.notification_templates SELECT * FROM %I.notification_templates',
          dest_schema, source_schema
        );
      END;
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.lab_results DROP COLUMN IF EXISTS parameter_id
    `);
    await queryRunner.query(`
      ALTER TABLE demo.lab_request_items DROP COLUMN IF EXISTS orderable_test_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_reference_ranges CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_test_parameters CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_orderable_tests CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_specimen_types CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_departments CASCADE`);
  }
}
