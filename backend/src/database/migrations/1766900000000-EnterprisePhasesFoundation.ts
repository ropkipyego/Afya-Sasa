import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterprisePhasesFoundation1766900000000 implements MigrationInterface {
  name = 'EnterprisePhasesFoundation1766900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.users
        ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS mfa_secret varchar,
        ADD COLUMN IF NOT EXISTS mfa_backup_codes jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.file_registry (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_code varchar NOT NULL DEFAULT 'demo',
        bucket varchar NOT NULL,
        object_key varchar NOT NULL,
        mime_type varchar,
        byte_size bigint,
        checksum_sha256 varchar,
        uploaded_by uuid REFERENCES demo.users(id),
        patient_id uuid REFERENCES demo.patients(id),
        encounter_id uuid REFERENCES demo.encounters(id),
        module varchar NOT NULL,
        purpose varchar,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        UNIQUE (tenant_code, bucket, object_key)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_registry_patient
      ON demo.file_registry (patient_id, created_at DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.clinical_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_no varchar NOT NULL UNIQUE,
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        encounter_id uuid REFERENCES demo.encounters(id),
        admission_id uuid REFERENCES demo.admissions(id),
        order_type varchar NOT NULL,
        source_module varchar NOT NULL,
        source_record_id uuid NOT NULL,
        status varchar NOT NULL DEFAULT 'requested',
        priority varchar NOT NULL DEFAULT 'routine',
        ordered_by uuid REFERENCES demo.users(id),
        ordered_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_orders_status_module
      ON demo.clinical_orders (status, source_module, ordered_at DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_orders_patient
      ON demo.clinical_orders (patient_id, ordered_at DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.notification_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type varchar NOT NULL,
        channel varchar NOT NULL DEFAULT 'in_app',
        recipient_user_id uuid REFERENCES demo.users(id),
        patient_id uuid REFERENCES demo.patients(id),
        payload jsonb NOT NULL DEFAULT '{}',
        status varchar NOT NULL DEFAULT 'pending',
        scheduled_at timestamptz NOT NULL DEFAULT now(),
        delivered_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_events_recipient_status
      ON demo.notification_events (recipient_user_id, status, scheduled_at DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE demo.lab_tests
        ADD COLUMN IF NOT EXISTS reference_range_male varchar,
        ADD COLUMN IF NOT EXISTS reference_range_female varchar,
        ADD COLUMN IF NOT EXISTS reference_range_child varchar,
        ADD COLUMN IF NOT EXISTS result_type varchar NOT NULL DEFAULT 'numeric',
        ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.apply_migration_to_all_tenant_schemas(
        migration_sql text
      ) RETURNS void
      LANGUAGE plpgsql
      AS $$
      DECLARE
        tenant_schema text;
      BEGIN
        FOR tenant_schema IN
          SELECT schema_name
          FROM public.tenants
          WHERE active = true
        LOOP
          EXECUTE format('SET search_path TO %I, public', tenant_schema);
          EXECUTE migration_sql;
        END LOOP;
        EXECUTE 'SET search_path TO demo, public';
      END;
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.apply_migration_to_all_tenant_schemas(text)`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.notification_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.clinical_orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.file_registry`);
    await queryRunner.query(`
      ALTER TABLE demo.lab_tests
        DROP COLUMN IF EXISTS reference_range_male,
        DROP COLUMN IF EXISTS reference_range_female,
        DROP COLUMN IF EXISTS reference_range_child,
        DROP COLUMN IF EXISTS result_type,
        DROP COLUMN IF EXISTS display_order,
        DROP COLUMN IF EXISTS active
    `);
    await queryRunner.query(`
      ALTER TABLE demo.users
        DROP COLUMN IF EXISTS mfa_enabled,
        DROP COLUMN IF EXISTS mfa_secret,
        DROP COLUMN IF EXISTS mfa_backup_codes
    `);
  }
}
