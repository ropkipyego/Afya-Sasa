import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive: allow pharmacy walk-in charges/payments without a patients row.
 * Non-pharmacy flows must still require a patient in application validation.
 * TYPEORM_MIGRATIONS_RUN stays false. Apply only on verified local/isolated databases.
 */
export class PharmacyWalkInCharges1772100000000 implements MigrationInterface {
  name = 'PharmacyWalkInCharges1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.charges ALTER COLUMN patient_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE demo.payment_transactions ALTER COLUMN patient_id DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.charges ALTER COLUMN patient_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE demo.payment_transactions ALTER COLUMN patient_id SET NOT NULL
    `);
  }
}
