import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsLabBillingFoundation1767900000000 implements MigrationInterface {
  name = 'PaymentsLabBillingFoundation1767900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.lab_requests
        ADD COLUMN IF NOT EXISTS payment_method varchar NULL,
        ADD COLUMN IF NOT EXISTS payer_scheme varchar NULL,
        ADD COLUMN IF NOT EXISTS payment_status varchar NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS payment_reference varchar NULL,
        ADD COLUMN IF NOT EXISTS mpesa_phone varchar NULL,
        ADD COLUMN IF NOT EXISTS billing_amount numeric NULL,
        ADD COLUMN IF NOT EXISTS walk_in_source varchar NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.payment_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        encounter_id uuid NULL REFERENCES demo.encounters(id),
        lab_request_id uuid NULL REFERENCES demo.lab_requests(id),
        method varchar NOT NULL,
        payer_scheme varchar NULL,
        amount numeric NULL,
        currency varchar NOT NULL DEFAULT 'KES',
        status varchar NOT NULL DEFAULT 'pending',
        external_reference varchar NULL,
        mpesa_phone varchar NULL,
        raw_callback jsonb NULL,
        metadata jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NULL,
        updated_by uuid NULL,
        deleted_at timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_lab_request
        ON demo.payment_transactions (lab_request_id)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.quickbooks_sync_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type varchar NOT NULL,
        entity_id uuid NOT NULL,
        action varchar NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}',
        status varchar NOT NULL DEFAULT 'pending',
        quickbooks_txn_id varchar NULL,
        error_message text NULL,
        synced_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (id, resource, action, permission_key, description)
      VALUES
        (gen_random_uuid(), 'payments', 'read', 'payments:read', 'View payment transactions'),
        (gen_random_uuid(), 'payments', 'initiate', 'payments:initiate', 'Initiate M-Pesa STK and payment flows'),
        (gen_random_uuid(), 'payments', 'manage', 'payments:manage', 'Manage payment integrations')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN ('payments:read', 'payments:initiate', 'payments:manage')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'records_officer'
        AND p.permission_key IN ('payments:read', 'payments:initiate')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.quickbooks_sync_queue`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.payment_transactions`);
    await queryRunner.query(`
      ALTER TABLE demo.lab_requests
        DROP COLUMN IF EXISTS payment_method,
        DROP COLUMN IF EXISTS payer_scheme,
        DROP COLUMN IF EXISTS payment_status,
        DROP COLUMN IF EXISTS payment_reference,
        DROP COLUMN IF EXISTS mpesa_phone,
        DROP COLUMN IF EXISTS billing_amount,
        DROP COLUMN IF EXISTS walk_in_source
    `);
  }
}
