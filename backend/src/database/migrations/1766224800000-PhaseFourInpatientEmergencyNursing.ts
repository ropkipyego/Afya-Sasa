import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseFourInpatientEmergencyNursing1766224800000
  implements MigrationInterface
{
  name = 'PhaseFourInpatientEmergencyNursing1766224800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.wards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE, type text NOT NULL,
      floor text, bed_count integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.beds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ward_id uuid NOT NULL REFERENCES demo.wards(id), bed_no text NOT NULL, type text NOT NULL, status text NOT NULL, version integer NOT NULL DEFAULT 1,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
      UNIQUE(ward_id, bed_no)
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.admissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_no text NOT NULL UNIQUE, patient_id uuid NOT NULL REFERENCES demo.patients(id), encounter_id uuid REFERENCES demo.encounters(id),
      bed_id uuid NOT NULL REFERENCES demo.beds(id), ward_id uuid NOT NULL REFERENCES demo.wards(id), admitting_doctor_id uuid REFERENCES demo.users(id),
      admitted_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL, type text NOT NULL, status text NOT NULL DEFAULT 'active',
      discharged_at timestamptz, discharging_doctor_id uuid REFERENCES demo.users(id), condition_on_discharge text, length_of_stay_days integer,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.bed_transfer_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), from_bed_id uuid NOT NULL REFERENCES demo.beds(id), to_bed_id uuid NOT NULL REFERENCES demo.beds(id),
      reason text NOT NULL, authorised_by uuid, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.daily_progress_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), subjective text NOT NULL, objective text NOT NULL, assessment text NOT NULL, plan text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.discharge_summaries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), presenting_complaint text NOT NULL, history text NOT NULL, exam_on_admission text NOT NULL,
      investigations_summary text NOT NULL, final_diagnosis text NOT NULL, treatment_given text NOT NULL, discharge_meds text NOT NULL, follow_up_instructions text NOT NULL, diet text,
      status text NOT NULL DEFAULT 'draft', finalised_by uuid, finalised_at timestamptz,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.emergency_encounters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id uuid NOT NULL REFERENCES demo.encounters(id), arrival_mode text NOT NULL, arrival_time timestamptz NOT NULL DEFAULT now(),
      trauma_flag boolean NOT NULL DEFAULT false, trauma_mechanism text, status text NOT NULL, disposition text, transfer_facility text, resuscitation_flag boolean NOT NULL DEFAULT false, resuscitation_notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.critical_alerts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id uuid NOT NULL REFERENCES demo.encounters(id), type text NOT NULL, severity text NOT NULL, message text NOT NULL, triggered_by uuid, is_auto boolean NOT NULL DEFAULT false,
      acknowledged_by uuid, acknowledged_at timestamptz, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.vital_signs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), encounter_id uuid REFERENCES demo.encounters(id), admission_id uuid REFERENCES demo.admissions(id), temperature numeric, pulse integer, respiratory_rate integer,
      bp_systolic integer, bp_diastolic integer, spo2 integer, weight numeric, height numeric, bmi numeric, blood_glucose numeric, gcs integer, urine_output numeric, recorded_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.medication_administration_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), medication_name text NOT NULL, generic_name text, dosage text NOT NULL, route text NOT NULL, frequency text NOT NULL,
      scheduled_time timestamptz NOT NULL, actual_time timestamptz, status text NOT NULL, withhold_reason text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.shift_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ward_id uuid NOT NULL REFERENCES demo.wards(id), shift text NOT NULL, date date NOT NULL, type text NOT NULL, body text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.nursing_observations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), type text NOT NULL, value text NOT NULL, unit text, recorded_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beds_status ON demo.beds(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_admissions_status ON demo.admissions(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_emergency_status ON demo.emergency_encounters(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alert_ack ON demo.critical_alerts(severity, acknowledged_at)`);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('wards','read','wards:read','Read wards'), ('wards','manage','wards:manage','Manage wards'),
        ('beds','read','beds:read','Read beds'), ('beds','manage','beds:manage','Manage beds'),
        ('admissions','read','admissions:read','Read admissions'), ('admissions','create','admissions:create','Create admissions'),
        ('admissions','transfer','admissions:transfer','Transfer beds'), ('admissions','discharge','admissions:discharge','Discharge admissions'),
        ('progress_notes','create','progress_notes:create','Create inpatient progress notes'),
        ('discharge_summaries','create','discharge_summaries:create','Create discharge summaries'), ('discharge_summaries','complete','discharge_summaries:complete','Complete discharge summaries'),
        ('emergency','create','emergency:create','Register emergency encounters'), ('emergency','read','emergency:read','Read emergency dashboard'), ('emergency','dispose','emergency:dispose','Dispose emergency encounters'),
        ('critical_alerts','create','critical_alerts:create','Create critical alerts'), ('critical_alerts','read','critical_alerts:read','Read critical alerts'), ('critical_alerts','acknowledge','critical_alerts:acknowledge','Acknowledge critical alerts'),
        ('vitals','create','vitals:create','Create vitals'), ('vitals','read','vitals:read','Read vitals'),
        ('mar','manage','mar:manage','Manage MAR'), ('mar','read','mar:read','Read MAR'),
        ('shift_notes','create','shift_notes:create','Create shift notes'), ('shift_notes','read','shift_notes:read','Read shift notes'),
        ('nursing_observations','create','nursing_observations:create','Create nursing observations'), ('nursing_observations','read','nursing_observations:read','Read nursing observations')
      ON CONFLICT (resource, action) DO NOTHING
    `);
    await queryRunner.query(`INSERT INTO demo.role_permissions (role_id, permission_id) SELECT r.id, p.id FROM demo.roles r CROSS JOIN demo.permissions p WHERE r.name = 'administrator' ON CONFLICT DO NOTHING`);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'wards:read','beds:read','admissions:read','admissions:create','admissions:transfer','admissions:discharge',
        'progress_notes:create','discharge_summaries:create','discharge_summaries:complete',
        'emergency:create','emergency:read','emergency:dispose','critical_alerts:create','critical_alerts:read','critical_alerts:acknowledge',
        'vitals:create','vitals:read','mar:read','shift_notes:read','nursing_observations:read'
      ) WHERE r.name = 'doctor' ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'wards:read','beds:read','admissions:read','emergency:create','emergency:read','critical_alerts:create','critical_alerts:read','critical_alerts:acknowledge',
        'vitals:create','vitals:read','mar:manage','mar:read','shift_notes:create','shift_notes:read','nursing_observations:create','nursing_observations:read'
      ) WHERE r.name = 'nurse' ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.nursing_observations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.shift_notes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.medication_administration_records CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.vital_signs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.critical_alerts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.emergency_encounters CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.discharge_summaries CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.daily_progress_notes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.bed_transfer_log CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.admissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.beds CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.wards CASCADE`);
  }
}
