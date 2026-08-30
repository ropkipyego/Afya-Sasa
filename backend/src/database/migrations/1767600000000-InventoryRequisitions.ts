import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryRequisitions1767600000000 implements MigrationInterface {
  name = 'InventoryRequisitions1767600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.inventory_locations (code, name, location_type)
      VALUES ('WARD-GENERAL', 'General Ward', 'ward')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_requisitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        requisition_no varchar NOT NULL UNIQUE,
        requesting_department varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'submitted',
        destination_location_id uuid REFERENCES demo.inventory_locations(id),
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_requisitions_status
      ON demo.inventory_requisitions (status, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_requisition_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        requisition_id uuid NOT NULL REFERENCES demo.inventory_requisitions(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
        quantity_requested numeric NOT NULL,
        quantity_issued numeric NOT NULL DEFAULT 0,
        fulfillment_route varchar NOT NULL,
        source_location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
        status varchar NOT NULL DEFAULT 'pending',
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_requisition_lines_req
      ON demo.inventory_requisition_lines (requisition_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_requisition_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_requisitions`);
  }
}
