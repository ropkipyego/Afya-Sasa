import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pharmacy stock holds. Apply via explicit SQL on an isolated local database only.
 * TYPEORM_MIGRATIONS_RUN must stay false for hospital compose.
 *
 * Reservations do not change qty_on_hand. Do not treat this table as a second ledger.
 */
export class InventoryReservations1772000000000 implements MigrationInterface {
  name = 'InventoryReservations1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id varchar NOT NULL,
        clinical_order_id uuid NULL,
        item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
        batch_id uuid NOT NULL REFERENCES demo.inventory_batches(id),
        location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
        quantity numeric NOT NULL,
        status varchar NOT NULL,
        prepare_op_id varchar NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_reservations_sale_status
        ON demo.inventory_reservations (sale_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_reservations_batch
        ON demo.inventory_reservations (batch_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_reservations`);
  }
}
