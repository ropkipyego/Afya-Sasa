import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalExcellenceSupport1766345000000 implements MigrationInterface {
  name = 'ClinicalExcellenceSupport1766345000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.sick_sheets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        encounter_id uuid REFERENCES demo.encounters(id),
        diagnosis text NOT NULL,
        days_off int NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        doctor_name varchar NOT NULL,
        license_number varchar,
        notes text,
        storage_path varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        created_by uuid,
        updated_by uuid
      )
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('notifications', 'read', 'notifications:read', 'View internal notification inbox'),
        ('sick_sheets', 'create', 'sick_sheets:create', 'Issue sick leave certificates'),
        ('sick_sheets', 'read', 'sick_sheets:read', 'View sick leave certificates')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN ('notifications:read', 'sick_sheets:create', 'sick_sheets:read')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN ('notifications:read', 'sick_sheets:create', 'sick_sheets:read')
      WHERE r.name IN ('doctor', 'nurse', 'receptionist')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.sick_sheets`);
  }
}
