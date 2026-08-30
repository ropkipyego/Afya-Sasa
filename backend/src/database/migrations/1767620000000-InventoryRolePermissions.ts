import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryRolePermissions1767620000000 implements MigrationInterface {
  name = 'InventoryRolePermissions1767620000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN ('inventory:read', 'inventory:manage')
      WHERE r.name IN ('doctor', 'nurse', 'administrator')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM demo.role_permissions rp
      USING demo.roles r, demo.permissions p
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
        AND r.name IN ('doctor', 'nurse')
        AND p.permission_key IN ('inventory:read', 'inventory:manage')
    `);
  }
}
