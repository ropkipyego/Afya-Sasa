import { MigrationInterface, QueryRunner } from 'typeorm';

export class LabAttachmentsHospitalDocs1766600000000 implements MigrationInterface {
  name = 'LabAttachmentsHospitalDocs1766600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.lab_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NOT NULL REFERENCES demo.lab_requests(id),
        filename varchar NOT NULL,
        mime_type varchar NOT NULL,
        storage_path varchar NOT NULL,
        title varchar,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_attachments_request
      ON demo.lab_attachments (request_id)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.hospital_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar NOT NULL,
        description text,
        category varchar NOT NULL DEFAULT 'general',
        filename varchar NOT NULL,
        mime_type varchar NOT NULL,
        storage_path varchar NOT NULL,
        file_size int NOT NULL DEFAULT 0,
        is_published boolean NOT NULL DEFAULT true,
        audience varchar NOT NULL DEFAULT 'all',
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('lab_attachments', 'create', 'lab_attachments:create', 'Attach PDF reports to lab requests'),
        ('lab_attachments', 'read', 'lab_attachments:read', 'View lab request PDF attachments'),
        ('lab_attachments', 'delete', 'lab_attachments:delete', 'Remove lab request PDF attachments'),
        ('hospital_documents', 'create', 'hospital_documents:create', 'Publish hospital-wide documents'),
        ('hospital_documents', 'read', 'hospital_documents:read', 'View hospital-wide document library'),
        ('hospital_documents', 'delete', 'hospital_documents:delete', 'Remove hospital-wide documents'),
        ('documents', 'delete', 'documents:delete', 'Delete patient clinical documents')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN (
          'lab_attachments:create', 'lab_attachments:read', 'lab_attachments:delete',
          'hospital_documents:create', 'hospital_documents:read', 'hospital_documents:delete',
          'documents:delete', 'lab_requests:create', 'files:upload', 'files:download'
        )
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'lab_requests:create',
        'lab_attachments:create', 'lab_attachments:read', 'lab_attachments:delete',
        'files:upload', 'files:download',
        'documents:create', 'documents:read', 'documents:delete'
      )
      WHERE r.name = 'lab_technician'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'lab_attachments:read',
        'hospital_documents:read',
        'files:download'
      )
      WHERE r.name IN ('doctor', 'nurse', 'receptionist', 'records_officer')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN ('hospital_documents:create', 'hospital_documents:delete')
      WHERE r.name IN ('administrator', 'records_officer')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.hospital_documents CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_attachments CASCADE`);
  }
}
