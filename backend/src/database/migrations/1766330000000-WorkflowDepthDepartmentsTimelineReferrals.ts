import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkflowDepthDepartmentsTimelineReferrals1766330000000
  implements MigrationInterface
{
  name = 'WorkflowDepthDepartmentsTimelineReferrals1766330000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.departments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE, type text, active boolean NOT NULL DEFAULT true,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.user_departments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES demo.users(id) ON DELETE CASCADE, department_id uuid NOT NULL REFERENCES demo.departments(id) ON DELETE CASCADE, is_primary boolean NOT NULL DEFAULT false,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, department_id)
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.referrals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES demo.patients(id), encounter_id uuid REFERENCES demo.encounters(id), referring_doctor_id uuid REFERENCES demo.users(id), receiving_user_id uuid REFERENCES demo.users(id),
      type text NOT NULL, target_department text, target_facility text, reason text NOT NULL, letter text NOT NULL, status text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`ALTER TABLE demo.lab_results ADD COLUMN IF NOT EXISTS reviewed_by uuid`);
    await queryRunner.query(`ALTER TABLE demo.lab_results ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`);
    await queryRunner.query(`ALTER TABLE demo.radiology_reports ADD COLUMN IF NOT EXISTS reviewed_by uuid`);
    await queryRunner.query(`ALTER TABLE demo.radiology_reports ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`);

    await queryRunner.query(`
      INSERT INTO demo.departments (id, name, code, type)
      VALUES
        ('80000000-0000-4000-8000-000000000001', 'Outpatient Department', 'OPD', 'clinical'),
        ('80000000-0000-4000-8000-000000000002', 'Laboratory', 'LAB', 'diagnostic'),
        ('80000000-0000-4000-8000-000000000003', 'Radiology', 'RAD', 'diagnostic'),
        ('80000000-0000-4000-8000-000000000004', 'Inpatient Wards', 'IPD', 'clinical'),
        ('80000000-0000-4000-8000-000000000005', 'Emergency Department', 'ED', 'clinical'),
        ('80000000-0000-4000-8000-000000000006', 'Theatre', 'THEATRE', 'clinical'),
        ('80000000-0000-4000-8000-000000000007', 'Maternity', 'MATERNITY', 'clinical'),
        ('80000000-0000-4000-8000-000000000008', 'Critical Care', 'CRITICAL_CARE', 'clinical')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('departments','manage','departments:manage','Manage departments'),
        ('referrals','create','referrals:create','Create referrals'),
        ('referrals','read','referrals:read','Read referrals'),
        ('referrals','update','referrals:update','Update referral status')
      ON CONFLICT (resource, action) DO NOTHING
    `);
    await queryRunner.query(`INSERT INTO demo.role_permissions (role_id, permission_id) SELECT r.id, p.id FROM demo.roles r CROSS JOIN demo.permissions p WHERE r.name = 'administrator' ON CONFLICT DO NOTHING`);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN ('referrals:create','referrals:read','referrals:update')
      WHERE r.name = 'doctor' ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.referrals CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.user_departments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.departments CASCADE`);
  }
}
