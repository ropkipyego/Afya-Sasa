import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces platform-owner superadmin role, strips platform:tenants from hospital
 * administrator, promotes seed platform owner (dual superadmin + administrator).
 */
export class SuperadminRoleFoundation1767700000000 implements MigrationInterface {
  name = 'SuperadminRoleFoundation1767700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.roles (id, name, label, description, is_system)
      VALUES (
        '10000000-0000-4000-8000-000000000010',
        'superadmin',
        'Super Admin',
        'Platform owner — unrestricted hospital and platform administration',
        true
      )
      ON CONFLICT (name) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('platform', 'superadmin', 'platform:superadmin', 'Unrestricted platform administration and RBAC governance')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'superadmin'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      DELETE FROM demo.role_permissions rp
      USING demo.roles r, demo.permissions p
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
        AND r.name = 'administrator'
        AND p.permission_key = 'platform:tenants'
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'users:manage',
        'roles:manage',
        'settings:manage',
        'audit_logs:read',
        'departments:manage'
      )
      WHERE r.name = 'administrator'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE demo.roles
      SET label = 'Hospital Administrator',
          description = 'Hospital-level administration — users, settings, and clinical configuration'
      WHERE name = 'administrator'
    `);

    await queryRunner.query(`
      INSERT INTO demo.user_roles (user_id, role_id)
      SELECT u.id, r.id
      FROM demo.users u
      CROSS JOIN demo.roles r
      WHERE u.id = '20000000-0000-4000-8000-000000000001'
        AND r.name = 'superadmin'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.user_roles (user_id, role_id)
      SELECT u.id, r.id
      FROM demo.users u
      CROSS JOIN demo.roles r
      WHERE u.employee_no = 'ADM-001'
        AND r.name = 'superadmin'
        AND NOT EXISTS (
          SELECT 1
          FROM demo.user_roles ur
          INNER JOIN demo.roles rr ON rr.id = ur.role_id
          WHERE ur.user_id = u.id AND rr.name = 'superadmin'
        )
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM demo.user_roles ur
      USING demo.roles r
      WHERE ur.role_id = r.id AND r.name = 'superadmin'
    `);

    await queryRunner.query(`
      DELETE FROM demo.role_permissions rp
      USING demo.roles r
      WHERE rp.role_id = r.id AND r.name = 'superadmin'
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key = 'platform:tenants'
      WHERE r.name = 'administrator'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      DELETE FROM demo.permissions
      WHERE permission_key = 'platform:superadmin'
    `);

    await queryRunner.query(`
      DELETE FROM demo.roles WHERE name = 'superadmin'
    `);
  }
}
