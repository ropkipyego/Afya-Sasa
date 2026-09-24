import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Therapeutic class on inventory items. Apply via explicit SQL only.
 * TYPEORM_MIGRATIONS_RUN must stay false.
 */
export class InventoryDrugClass1770300000000 implements MigrationInterface {
  name = 'InventoryDrugClass1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.inventory_items
        ADD COLUMN IF NOT EXISTS drug_class varchar NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_items_drug_class
        ON demo.inventory_items (drug_class)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_inventory_items_drug_class`);
    await queryRunner.query(`ALTER TABLE demo.inventory_items DROP COLUMN IF EXISTS drug_class`);
  }
}
