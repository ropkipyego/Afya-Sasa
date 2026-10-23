import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryStockTakeSessions1772200000000 implements MigrationInterface {
  name = 'InventoryStockTakeSessions1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_stock_take_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
        status varchar NOT NULL DEFAULT 'open',
        baseline_at timestamptz NOT NULL DEFAULT now(),
        notes varchar NULL,
        submitted_by uuid NULL,
        submitted_at timestamptz NULL,
        rejected_by uuid NULL,
        rejected_at timestamptz NULL,
        reject_reason varchar NULL,
        approved_by uuid NULL,
        approved_at timestamptz NULL,
        posted_at timestamptz NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_stock_take_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES demo.inventory_stock_take_sessions(id),
        item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
        batch_id uuid NULL REFERENCES demo.inventory_batches(id),
        expected_qty numeric NOT NULL,
        counted_qty numeric NULL,
        variance_qty numeric NULL,
        reason varchar NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_take_sessions_open_location
      ON demo.inventory_stock_take_sessions (location_id)
      WHERE status IN ('open', 'submitted', 'rejected') AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS inventory_stock_take_lines_session_idx
      ON demo.inventory_stock_take_lines (session_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_stock_take_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_stock_take_sessions`);
  }
}
