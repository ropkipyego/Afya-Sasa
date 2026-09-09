import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalDepartmentsAndClinics1768000000000 implements MigrationInterface {
  name = 'ClinicalDepartmentsAndClinics1768000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.clinics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        department_id uuid REFERENCES demo.departments(id) ON DELETE SET NULL,
        active boolean NOT NULL DEFAULT true,
        doctor_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clinics_department_active
        ON demo.clinics (department_id, active)
    `);

    await queryRunner.query(`
      INSERT INTO demo.clinics (id, name, code, department_id, active)
      VALUES
        ('81000000-0000-4000-8000-000000000001', 'General OPD', 'GENERAL_OPD', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000002', 'Cardiology', 'CARDIOLOGY', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000003', 'Orthopaedic', 'ORTHOPAEDIC', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000004', 'Paediatrics Clinic', 'PAEDIATRICS_CLINIC', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000005', 'ENT', 'ENT', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000006', 'Dermatology', 'DERMATOLOGY', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000007', 'Gynaecology', 'GYNAECOLOGY', '80000000-0000-4000-8000-000000000001', true),
        ('81000000-0000-4000-8000-000000000008', 'Maternity Clinic', 'MATERNITY_CLINIC', '80000000-0000-4000-8000-000000000007', true)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.clinics CASCADE`);
  }
}
