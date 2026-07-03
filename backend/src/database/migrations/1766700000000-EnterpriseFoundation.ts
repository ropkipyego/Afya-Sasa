import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterpriseFoundation1766700000000 implements MigrationInterface {
  name = 'EnterpriseFoundation1766700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.login_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES demo.users(id),
        email varchar NOT NULL,
        event_type varchar NOT NULL,
        success boolean NOT NULL DEFAULT false,
        failure_reason varchar,
        ip_address varchar,
        user_agent text,
        device varchar,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_login_events_email_created
      ON demo.login_events (email, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_login_events_user_created
      ON demo.login_events (user_id, created_at DESC)
      WHERE user_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES demo.users(id) ON DELETE CASCADE,
        token_hash varchar NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
      ON demo.password_reset_tokens (user_id, expires_at DESC)
      WHERE used_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_patient_no
      ON demo.patients (patient_no)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_primary_phone
      ON demo.patients (primary_phone)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_name_dob
      ON demo.patients (last_name, first_name, date_of_birth)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_identifiers_value
      ON demo.patient_identifiers (value)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounters_status_started
      ON demo.encounters (status, started_at DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admissions_status_admitted
      ON demo.admissions (status, admitted_at DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_requests_status_created
      ON demo.lab_requests (status, created_at DESC)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE demo.refresh_tokens
      DROP CONSTRAINT IF EXISTS fk_refresh_tokens_user
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_refresh_tokens_user'
        ) THEN
          ALTER TABLE demo.refresh_tokens
          ADD CONSTRAINT fk_refresh_tokens_user
          FOREIGN KEY (user_id) REFERENCES demo.users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('worklists', 'read', 'worklists:read', 'View operational patient worklists'),
        ('auth', 'password_reset', 'auth:password_reset', 'Request and complete password reset')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN ('worklists:read', 'auth:password_reset')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key = 'worklists:read'
      WHERE r.name IN (
        'doctor', 'nurse', 'records_officer', 'lab_technician',
        'radiology_technician', 'administrator'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.password_reset_tokens CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.login_events CASCADE`);
  }
}
