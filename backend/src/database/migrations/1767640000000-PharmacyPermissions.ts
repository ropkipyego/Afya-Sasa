import { MigrationInterface, QueryRunner } from 'typeorm';

export class PharmacyPermissions1767640000000 implements MigrationInterface {
  name = 'PharmacyPermissions1767640000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('pharmacy', 'read', 'pharmacy:read', 'View pharmacy queue and prescriptions'),
        ('pharmacy', 'prescribe', 'pharmacy:prescribe', 'Create pharmacy prescriptions'),
        ('pharmacy', 'dispense', 'pharmacy:dispense', 'Dispense medications from pharmacy stock')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key = 'pharmacy:read'
      WHERE r.name IN ('administrator', 'doctor', 'nurse')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key = 'pharmacy:prescribe'
      WHERE r.name IN ('administrator', 'doctor')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key = 'pharmacy:dispense'
      WHERE r.name IN ('administrator', 'nurse')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM demo.role_permissions rp
      USING demo.roles r, demo.permissions p
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
        AND p.permission_key IN ('pharmacy:read', 'pharmacy:prescribe', 'pharmacy:dispense')
    `);

    await queryRunner.query(`
      DELETE FROM demo.permissions
      WHERE permission_key IN ('pharmacy:read', 'pharmacy:prescribe', 'pharmacy:dispense')
    `);
  }
}
