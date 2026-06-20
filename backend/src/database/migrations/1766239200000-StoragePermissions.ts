import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoragePermissions1766239200000 implements MigrationInterface {
  name = 'StoragePermissions1766239200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('files', 'upload', 'files:upload', 'Create signed upload URLs for clinical files'),
        ('files', 'download', 'files:download', 'Create signed download URLs for clinical files')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN ('files:upload', 'files:download')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN ('files:upload', 'files:download')
      WHERE r.name IN ('doctor', 'nurse', 'radiology_technician')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(): Promise<void> {
    // Keep permission rows for audit continuity.
  }
}
