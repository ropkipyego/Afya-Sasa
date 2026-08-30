import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryEngineFoundation1767500000000 implements MigrationInterface {
  name = 'InventoryEngineFoundation1767500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        category varchar NOT NULL,
        unit varchar NOT NULL,
        track_batch boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        location_type varchar NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_batches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
        location_id uuid NOT NULL REFERENCES demo.inventory_locations(id),
        batch_no varchar,
        expiry_date date,
        qty_on_hand numeric NOT NULL DEFAULT 0,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_location
      ON demo.inventory_batches (item_id, location_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.inventory_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id uuid NOT NULL REFERENCES demo.inventory_items(id),
        batch_id uuid REFERENCES demo.inventory_batches(id),
        source_location_id uuid REFERENCES demo.inventory_locations(id),
        destination_location_id uuid REFERENCES demo.inventory_locations(id),
        quantity numeric NOT NULL,
        unit varchar NOT NULL,
        transaction_type varchar NOT NULL,
        reference_type varchar,
        reference_id uuid,
        reason text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_created
      ON demo.inventory_transactions (item_id, created_at DESC)
    `);

    await queryRunner.query(`
      INSERT INTO demo.inventory_locations (code, name, location_type)
      VALUES
        ('PHARMACY', 'Pharmacy Store', 'pharmacy'),
        ('MAIN_STORE', 'Main Store', 'main_store')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.inventory_items (sku, name, category, unit, track_batch)
      VALUES
        ('PARA500', 'Paracetamol 500mg tablet', 'pharmaceutical', 'tablet', true),
        ('GLOVES-M', 'Examination gloves (medium)', 'medical_consumable', 'pair', false)
      ON CONFLICT (sku) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('inventory', 'read', 'inventory:read', 'View inventory items, locations, and balances'),
        ('inventory', 'manage', 'inventory:manage', 'Receive stock and manage inventory master data')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN ('inventory:read', 'inventory:manage')
      WHERE r.name = 'administrator'
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_batches`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.inventory_locations`);
  }
}
