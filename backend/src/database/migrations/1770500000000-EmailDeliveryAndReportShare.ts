import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailDeliveryAndReportShare1770500000000 implements MigrationInterface {
  name = 'EmailDeliveryAndReportShare1770500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.email_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        idempotency_key varchar NOT NULL UNIQUE,
        purpose varchar NOT NULL,
        recipient_fingerprint varchar NOT NULL,
        recipient_domain varchar NOT NULL,
        subject varchar NOT NULL,
        status varchar NOT NULL,
        attempts int NOT NULL DEFAULT 0,
        last_error_safe varchar,
        provider_message_id varchar,
        accepted_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_deliveries_purpose
        ON demo.email_deliveries (purpose, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.report_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow varchar NOT NULL,
        report_type varchar NOT NULL,
        export_scope varchar NOT NULL,
        date_from date,
        date_to date,
        requester_user_id uuid NOT NULL,
        recipient_user_id uuid,
        recipient_fingerprint varchar NOT NULL,
        token_hash varchar NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        email_delivery_id uuid,
        status varchar NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('reports', 'government_notify', 'reports:government_notify', 'Send government integration notifications (not statutory submissions)')
      ON CONFLICT (resource, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name IN ('administrator', 'superadmin')
        AND p.permission_key = 'reports:government_notify'
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.report_deliveries`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.email_deliveries`);
  }
}
