import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 — transactional marketing activities.
 *
 * Creates demo.marketing_visits and marketing:* permissions.
 * Does NOT alter public.settings or migrate clinical_catalog.marketingVisits JSON.
 * Catalog arrays (marketingSites / marketingActivities) are left untouched.
 */
export class MarketingActivitiesFoundation1768300000000 implements MigrationInterface {
  name = 'MarketingActivitiesFoundation1768300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.marketing_visits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid NOT NULL REFERENCES demo.users(id),
        activity_date date NOT NULL,
        location varchar,
        facility_name varchar NOT NULL,
        contact_person varchar,
        contact_phone varchar,
        purpose varchar,
        activity_type varchar NOT NULL,
        services_promoted text,
        people_reached int NOT NULL DEFAULT 0,
        leads_generated int NOT NULL DEFAULT 0,
        referrals_generated int NOT NULL DEFAULT 0,
        follow_up_required boolean NOT NULL DEFAULT false,
        follow_up_date date,
        follow_up_completed boolean NOT NULL DEFAULT false,
        outcome varchar,
        next_action text,
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_owner
        ON demo.marketing_visits (owner_user_id)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_activity_date
        ON demo.marketing_visits (activity_date)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_facility
        ON demo.marketing_visits (facility_name)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_location
        ON demo.marketing_visits (location)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_outcome
        ON demo.marketing_visits (outcome)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_follow_up_date
        ON demo.marketing_visits (follow_up_date)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_visits_owner_date
        ON demo.marketing_visits (owner_user_id, activity_date DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('marketing', 'read', 'marketing:read', 'View own marketing activities and catalog'),
        ('marketing', 'create', 'marketing:create', 'Record marketing activities'),
        ('marketing', 'update', 'marketing:update', 'Update own marketing activities'),
        ('marketing', 'delete', 'marketing:delete', 'Remove own marketing activities'),
        ('marketing', 'manage', 'marketing:manage', 'Manage team marketing activities and catalog import'),
        ('marketing', 'reports', 'marketing:reports', 'View team marketing performance reports')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'marketing:read',
        'marketing:create',
        'marketing:update',
        'marketing:delete',
        'marketing:manage',
        'marketing:reports'
      )
      WHERE r.name IN ('administrator', 'superadmin')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM demo.role_permissions rp
      USING demo.roles r, demo.permissions p
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
        AND p.permission_key IN (
          'marketing:read',
          'marketing:create',
          'marketing:update',
          'marketing:delete',
          'marketing:manage',
          'marketing:reports'
        )
    `);
    await queryRunner.query(`
      DELETE FROM demo.permissions
      WHERE permission_key IN (
        'marketing:read',
        'marketing:create',
        'marketing:update',
        'marketing:delete',
        'marketing:manage',
        'marketing:reports'
      )
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_owner_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_follow_up_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_outcome`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_location`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_facility`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_activity_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_marketing_visits_owner`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.marketing_visits`);
  }
}
