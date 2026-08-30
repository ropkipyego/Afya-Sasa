import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryTransfers1767630000000 implements MigrationInterface {
  name = 'InventoryTransfers1767630000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_transfers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_no varchar NOT NULL UNIQUE,
        source_location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
        destination_location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
        status varchar NOT NULL DEFAULT 'pending',
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status
      ON demo.inventory_transfers (status, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_transfer_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transfer_id uuid NOT NULL REFERENCES demo.inventory_transfers(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
        quantity numeric NOT NULL,
        batch_id uuid REFERENCES demo.inventory_batches(id),
        status varchar NOT NULL DEFAULT 'pending',
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_transfer_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_transfers`);
  }
}
