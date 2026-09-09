import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShaEligibilityChecks1768200000000 implements MigrationInterface {
  name = 'ShaEligibilityChecks1768200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.patient_identifiers
        DROP CONSTRAINT IF EXISTS patient_identifiers_type_check
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.sha_eligibility_checks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid REFERENCES demo.patients(id) ON DELETE SET NULL,
        identification_type text NOT NULL,
        identification_number text NOT NULL,
        outcome text NOT NULL,
        source text NOT NULL,
        member_cr_number text,
        full_name text,
        date_of_birth text,
        gender text,
        age integer,
        is_alive boolean,
        whitelisted_for_otp boolean,
        facility_biometrics_enforced boolean,
        status_code text,
        status_desc text,
        schemes jsonb NOT NULL DEFAULT '[]'::jsonb,
        pomsf_eligible boolean NOT NULL DEFAULT false,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sha_eligibility_patient_created
        ON demo.sha_eligibility_checks (patient_id, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.sha_eligibility_checks`);
  }
}
