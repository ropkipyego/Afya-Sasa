import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsServiceLineAndRadiologyForm1767910000000 implements MigrationInterface {
  name = 'PaymentsServiceLineAndRadiologyForm1767910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.payment_transactions
        ADD COLUMN IF NOT EXISTS service_line varchar NULL,
        ADD COLUMN IF NOT EXISTS service_entity_id uuid NULL,
        ADD COLUMN IF NOT EXISTS service_description varchar NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_patient_service
        ON demo.payment_transactions (patient_id, service_line, created_at DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE demo.radiology_requests
        ADD COLUMN IF NOT EXISTS request_form_data jsonb NULL,
        ADD COLUMN IF NOT EXISTS referring_clinician varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.radiology_requests
        DROP COLUMN IF EXISTS request_form_data,
        DROP COLUMN IF EXISTS referring_clinician
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_payment_transactions_patient_service`);
    await queryRunner.query(`
      ALTER TABLE demo.payment_transactions
        DROP COLUMN IF EXISTS service_line,
        DROP COLUMN IF EXISTS service_entity_id,
        DROP COLUMN IF EXISTS service_description
    `);
  }
}
