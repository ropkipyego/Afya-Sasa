import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dedicated catalogue strength and dosage form. Apply via explicit SQL only.
 * TYPEORM_MIGRATIONS_RUN must stay false.
 */
export class InventoryStrengthForm1771000000000 implements MigrationInterface {
  name = 'InventoryStrengthForm1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.inventory_items
        ADD COLUMN IF NOT EXISTS strength varchar NULL,
        ADD COLUMN IF NOT EXISTS dosage_form varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE demo.inventory_items DROP COLUMN IF EXISTS dosage_form`);
    await queryRunner.query(`ALTER TABLE demo.inventory_items DROP COLUMN IF EXISTS strength`);
  }
}
