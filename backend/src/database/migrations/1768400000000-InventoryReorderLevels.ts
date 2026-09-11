import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryReorderLevels1768400000000 implements MigrationInterface {
  name = 'InventoryReorderLevels1768400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.inventory_items
        ADD COLUMN IF NOT EXISTS min_level numeric NULL,
        ADD COLUMN IF NOT EXISTS max_level numeric NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_items_min_level
        ON demo.inventory_items (min_level)
        WHERE min_level IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_inventory_items_min_level`);
    await queryRunner.query(`
      ALTER TABLE demo.inventory_items
        DROP COLUMN IF EXISTS max_level,
        DROP COLUMN IF EXISTS min_level
    `);
  }
}
