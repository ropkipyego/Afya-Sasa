import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalDocuments1766500000000 implements MigrationInterface {
  name = 'ClinicalDocuments1766500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.clinical_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        document_type varchar NOT NULL,
        title varchar NOT NULL,
        description text,
        filename varchar NOT NULL,
        mime_type varchar NOT NULL,
        storage_path varchar NOT NULL,
        file_size int NOT NULL DEFAULT 0,
        checksum varchar,
        encounter_id uuid,
        admission_id uuid,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinical_documents_patient_type
      ON demo.clinical_documents (patient_id, document_type)
      WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('documents', 'read', 'documents:read', 'View clinical document metadata'),
        ('documents', 'create', 'documents:create', 'Register uploaded clinical documents')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN ('documents:read', 'documents:create')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN ('documents:read', 'documents:create')
      WHERE r.name IN ('doctor', 'nurse', 'receptionist', 'records_officer')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.clinical_documents`);
  }
}
