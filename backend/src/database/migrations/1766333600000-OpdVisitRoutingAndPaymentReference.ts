import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpdVisitRoutingAndPaymentReference1766333600000
  implements MigrationInterface
{
  name = 'OpdVisitRoutingAndPaymentReference1766333600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE demo.encounters ADD COLUMN IF NOT EXISTS destination text`);
    await queryRunner.query(`ALTER TABLE demo.encounters ADD COLUMN IF NOT EXISTS department_name text`);
    await queryRunner.query(`ALTER TABLE demo.encounters ADD COLUMN IF NOT EXISTS payment_method text`);
    await queryRunner.query(`ALTER TABLE demo.encounters ADD COLUMN IF NOT EXISTS receipt_number text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE demo.encounters DROP COLUMN IF EXISTS receipt_number`);
    await queryRunner.query(`ALTER TABLE demo.encounters DROP COLUMN IF EXISTS payment_method`);
    await queryRunner.query(`ALTER TABLE demo.encounters DROP COLUMN IF EXISTS department_name`);
    await queryRunner.query(`ALTER TABLE demo.encounters DROP COLUMN IF EXISTS destination`);
  }
}
