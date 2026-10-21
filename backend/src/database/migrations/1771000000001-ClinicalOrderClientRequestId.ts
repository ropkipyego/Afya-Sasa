import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unique prescription client request id. Apply via explicit SQL only.
 * TYPEORM_MIGRATIONS_RUN must stay false.
 */
export class ClinicalOrderClientRequestId1771000000001 implements MigrationInterface {
  name = 'ClinicalOrderClientRequestId1771000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.clinical_orders
        ADD COLUMN IF NOT EXISTS client_request_id varchar NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_orders_client_request_id
        ON demo.clinical_orders (client_request_id)
        WHERE client_request_id IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS demo.uq_clinical_orders_client_request_id`);
    await queryRunner.query(`ALTER TABLE demo.clinical_orders DROP COLUMN IF EXISTS client_request_id`);
  }
}
