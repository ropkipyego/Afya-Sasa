import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImplementLabRadiology1766235600000 implements MigrationInterface {
  name = 'ImplementLabRadiology1766235600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.lab_panels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE, description text, category text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.lab_tests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), panel_id uuid REFERENCES demo.lab_panels(id), name text NOT NULL, code text NOT NULL UNIQUE, sample_type text NOT NULL, turnaround_hours integer, reference_range text, unit text, critical_low numeric, critical_high numeric,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.lab_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES demo.patients(id), encounter_id uuid NOT NULL REFERENCES demo.encounters(id), admission_id uuid REFERENCES demo.admissions(id), request_no text NOT NULL UNIQUE, priority text NOT NULL, notes text, status text NOT NULL, cancelled_reason text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.lab_request_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES demo.lab_requests(id), test_id uuid REFERENCES demo.lab_tests(id), panel_id uuid REFERENCES demo.lab_panels(id), status text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.lab_samples (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES demo.lab_requests(id), barcode text NOT NULL UNIQUE, type text NOT NULL, collected_at timestamptz, received_at timestamptz, condition text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.lab_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_item_id uuid NOT NULL REFERENCES demo.lab_request_items(id), sample_id uuid REFERENCES demo.lab_samples(id), value text NOT NULL, unit text, flag text NOT NULL, reference_range text, is_critical boolean NOT NULL DEFAULT false, entered_at timestamptz NOT NULL DEFAULT now(), verified_by uuid, verified_at timestamptz,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.radiology_modalities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.radiology_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES demo.patients(id), encounter_id uuid NOT NULL REFERENCES demo.encounters(id), admission_id uuid REFERENCES demo.admissions(id), modality_id uuid NOT NULL REFERENCES demo.radiology_modalities(id), request_no text NOT NULL UNIQUE, body_part text NOT NULL, views text, clinical_indication text NOT NULL, priority text NOT NULL, status text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.radiology_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES demo.radiology_requests(id), findings text NOT NULL, impression text NOT NULL, recommendation text, verified_by uuid, verified_at timestamptz,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.radiology_attachments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES demo.radiology_requests(id), filename text NOT NULL, mime_type text NOT NULL, storage_path text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lab_requests_status ON demo.lab_requests(status, priority)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lab_results_critical ON demo.lab_results(is_critical, verified_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_radiology_requests_status ON demo.radiology_requests(status, priority)`);

    await queryRunner.query(`
      INSERT INTO demo.lab_panels (id, name, code, description, category)
      VALUES
        ('60000000-0000-4000-8000-000000000001', 'Complete Blood Count', 'CBC', 'Full haemogram panel', 'haematology'),
        ('60000000-0000-4000-8000-000000000002', 'Urea and Electrolytes', 'UE', 'Renal function panel', 'biochemistry'),
        ('60000000-0000-4000-8000-000000000003', 'Malaria Screen', 'MAL', 'Malaria rapid/microscopy screen', 'microbiology')
      ON CONFLICT (code) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.lab_tests (panel_id, name, code, sample_type, turnaround_hours, reference_range, unit, critical_low, critical_high)
      VALUES
        ('60000000-0000-4000-8000-000000000001', 'Haemoglobin', 'HB', 'whole_blood', 4, '12-16', 'g/dL', 6, 22),
        ('60000000-0000-4000-8000-000000000001', 'White Cell Count', 'WCC', 'whole_blood', 4, '4-11', '10^9/L', 1, 50),
        ('60000000-0000-4000-8000-000000000002', 'Creatinine', 'CREAT', 'serum', 8, '60-110', 'umol/L', NULL, 600),
        ('60000000-0000-4000-8000-000000000003', 'Malaria Parasite', 'MP', 'whole_blood', 2, 'Negative', NULL, NULL, NULL)
      ON CONFLICT (code) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.radiology_modalities (id, name, code)
      VALUES
        ('70000000-0000-4000-8000-000000000001', 'X-Ray', 'XRAY'),
        ('70000000-0000-4000-8000-000000000002', 'Ultrasound', 'US'),
        ('70000000-0000-4000-8000-000000000003', 'CT Scan', 'CT')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('lab_catalogue','read','lab_catalogue:read','Read lab catalogue'), ('lab_catalogue','manage','lab_catalogue:manage','Manage lab catalogue'),
        ('lab_requests','create','lab_requests:create','Create lab requests'), ('lab_requests','read','lab_requests:read','Read lab requests'),
        ('lab_samples','collect','lab_samples:collect','Collect lab samples'), ('lab_samples','receive','lab_samples:receive','Receive lab samples'),
        ('lab_results','enter','lab_results:enter','Enter lab results'), ('lab_results','verify','lab_results:verify','Verify lab results'), ('lab_results','read','lab_results:read','Read verified lab results'),
        ('radiology_catalogue','read','radiology_catalogue:read','Read radiology catalogue'), ('radiology_catalogue','manage','radiology_catalogue:manage','Manage radiology catalogue'),
        ('radiology_requests','create','radiology_requests:create','Create radiology requests'), ('radiology_requests','read','radiology_requests:read','Read radiology requests'), ('radiology_requests','update','radiology_requests:update','Update radiology requests'),
        ('radiology_reports','create','radiology_reports:create','Create radiology reports'), ('radiology_reports','verify','radiology_reports:verify','Verify radiology reports'), ('radiology_reports','read','radiology_reports:read','Read radiology reports'),
        ('radiology_attachments','create','radiology_attachments:create','Create radiology attachments')
      ON CONFLICT (resource, action) DO NOTHING
    `);
    await queryRunner.query(`INSERT INTO demo.role_permissions (role_id, permission_id) SELECT r.id, p.id FROM demo.roles r CROSS JOIN demo.permissions p WHERE r.name = 'administrator' ON CONFLICT DO NOTHING`);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'lab_catalogue:read','lab_requests:create','lab_requests:read','lab_results:read',
        'radiology_catalogue:read','radiology_requests:create','radiology_requests:read','radiology_reports:read'
      ) WHERE r.name = 'doctor' ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'lab_catalogue:read','lab_requests:read','lab_samples:collect','lab_samples:receive','lab_results:enter','lab_results:verify','lab_results:read'
      ) WHERE r.name = 'lab_technician' ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'radiology_catalogue:read','radiology_requests:read','radiology_requests:update','radiology_reports:create','radiology_reports:verify','radiology_reports:read','radiology_attachments:create'
      ) WHERE r.name = 'radiology_technician' ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.radiology_attachments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.radiology_reports CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.radiology_requests CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.radiology_modalities CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_results CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_samples CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_request_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_requests CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_tests CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.lab_panels CASCADE`);
  }
}
