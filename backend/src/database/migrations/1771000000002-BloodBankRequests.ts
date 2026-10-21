import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Laboratory blood-bank requests. Not pharmacy lots. Apply via explicit SQL only.
 * TYPEORM_MIGRATIONS_RUN must stay false.
 */
export class BloodBankRequests1771000000002 implements MigrationInterface {
  name = 'BloodBankRequests1771000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.blood_bank_requests (
        id uuid PRIMARY KEY,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        request_no varchar NOT NULL UNIQUE,
        patient_id uuid NOT NULL,
        encounter_id uuid NULL,
        admission_id uuid NULL,
        product varchar NOT NULL,
        units numeric NOT NULL,
        patient_blood_group varchar NULL,
        indication text NULL,
        status varchar NOT NULL DEFAULT 'requested',
        grouping_result varchar NULL,
        crossmatch_result varchar NULL,
        issued_at timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_blood_bank_requests_status
        ON demo.blood_bank_requests (status)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.blood_bank_requests`);
  }
}
