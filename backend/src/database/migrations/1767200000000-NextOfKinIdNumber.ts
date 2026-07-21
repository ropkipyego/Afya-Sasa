import { MigrationInterface, QueryRunner } from 'typeorm';

/** Store an optional identity number for each patient next-of-kin contact. */
export class NextOfKinIdNumber1767200000000 implements MigrationInterface {
  name = 'NextOfKinIdNumber1767200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.patient_next_of_kin
      ADD COLUMN IF NOT EXISTS id_number varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.patient_next_of_kin
      DROP COLUMN IF EXISTS id_number
    `);
  }
}
