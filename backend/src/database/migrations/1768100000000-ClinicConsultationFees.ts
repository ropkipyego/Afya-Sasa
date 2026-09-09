import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicConsultationFees1768100000000 implements MigrationInterface {
  name = 'ClinicConsultationFees1768100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.clinics
        ADD COLUMN IF NOT EXISTS consultation_fee numeric(12,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE demo.clinics SET consultation_fee = fee.amount
      FROM (VALUES
        ('GENERAL_OPD', 1000),
        ('CARDIOLOGY', 2500),
        ('ORTHOPAEDIC', 2000),
        ('PAEDIATRICS_CLINIC', 1500),
        ('ENT', 2000),
        ('DERMATOLOGY', 2000),
        ('GYNAECOLOGY', 2000),
        ('MATERNITY_CLINIC', 1500)
      ) AS fee(code, amount)
      WHERE demo.clinics.code = fee.code
        AND demo.clinics.consultation_fee = 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.clinics DROP COLUMN IF EXISTS consultation_fee
    `);
  }
}
