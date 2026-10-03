import { MigrationInterface, QueryRunner } from 'typeorm';

export class BiometricIdentityFoundation1770400000000 implements MigrationInterface {
  name = 'BiometricIdentityFoundation1770400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.biometric_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        device_key text NOT NULL UNIQUE,
        name text NOT NULL,
        provider text NOT NULL,
        location text,
        status text NOT NULL DEFAULT 'pending',
        secret_hash text NOT NULL,
        agent_version text,
        last_heartbeat_at timestamptz,
        last_success_at timestamptz,
        last_error text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.biometric_identities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        provider text NOT NULL,
        device_id text,
        external_subject_id text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        template_cipher text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        UNIQUE (external_subject_id, provider)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.biometric_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid REFERENCES demo.patients(id),
        biometric_identity_id uuid REFERENCES demo.biometric_identities(id),
        device_id text,
        provider text NOT NULL,
        operator_user_id uuid,
        purpose text NOT NULL,
        result text NOT NULL,
        confidence numeric,
        external_reference text,
        correlation_id text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_biometric_verifications_patient
        ON demo.biometric_verifications (patient_id, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.biometric_verifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.biometric_identities`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.biometric_devices`);
  }
}
