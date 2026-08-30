import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalOrdersAuditColumns1767610000000 implements MigrationInterface {
  name = 'ClinicalOrdersAuditColumns1767610000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.clinical_orders
      ADD COLUMN IF NOT EXISTS created_by uuid,
      ADD COLUMN IF NOT EXISTS updated_by uuid
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.clinical_orders
      DROP COLUMN IF EXISTS created_by,
      DROP COLUMN IF EXISTS updated_by
    `);
  }
}
