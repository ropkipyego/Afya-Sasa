import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImplementTheatreMaternityIcuHdu1766232000000
  implements MigrationInterface
{
  name = 'ImplementTheatreMaternityIcuHdu1766232000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.theatres (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE, location text, status text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.surgical_procedures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE, category text, description text, expected_duration_minutes integer, active boolean NOT NULL DEFAULT true,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.surgery_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_no text NOT NULL UNIQUE, patient_id uuid NOT NULL REFERENCES demo.patients(id), encounter_id uuid REFERENCES demo.encounters(id), admission_id uuid REFERENCES demo.admissions(id),
      procedure_id uuid NOT NULL REFERENCES demo.surgical_procedures(id), theatre_id uuid REFERENCES demo.theatres(id), scheduled_start_at timestamptz NOT NULL, scheduled_end_at timestamptz, actual_start_at timestamptz, actual_end_at timestamptz,
      priority text NOT NULL, status text NOT NULL, consent_status text NOT NULL DEFAULT 'pending', checklist_status text NOT NULL DEFAULT 'pending',
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.surgery_staff (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), surgery_booking_id uuid NOT NULL REFERENCES demo.surgery_bookings(id), user_id uuid NOT NULL REFERENCES demo.users(id), role text NOT NULL, assigned_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
      UNIQUE(surgery_booking_id, user_id, role)
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.surgery_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), surgery_booking_id uuid NOT NULL REFERENCES demo.surgery_bookings(id), author_id uuid REFERENCES demo.users(id), amends_note_id uuid REFERENCES demo.surgery_notes(id),
      type text NOT NULL, body text NOT NULL, amendment_reason text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.surgery_complications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), surgery_booking_id uuid NOT NULL REFERENCES demo.surgery_bookings(id), reported_by uuid REFERENCES demo.users(id), severity text NOT NULL, description text NOT NULL, action_taken text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.pregnancies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pregnancy_no text NOT NULL UNIQUE, patient_id uuid NOT NULL REFERENCES demo.patients(id), registration_encounter_id uuid REFERENCES demo.encounters(id), admission_id uuid REFERENCES demo.admissions(id),
      gravida integer NOT NULL, para integer NOT NULL, lmp_date date, edd date, risk_level text NOT NULL DEFAULT 'low', risk_notes text, status text NOT NULL DEFAULT 'active',
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.anc_visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pregnancy_id uuid NOT NULL REFERENCES demo.pregnancies(id), encounter_id uuid REFERENCES demo.encounters(id), clinician_id uuid REFERENCES demo.users(id), visit_date date NOT NULL, gestational_age_weeks integer, risk_assessment text, plan text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.labour_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pregnancy_id uuid NOT NULL REFERENCES demo.pregnancies(id), admission_id uuid REFERENCES demo.admissions(id), recorded_at timestamptz NOT NULL DEFAULT now(), cervical_dilation_cm numeric, contractions text, fetal_heart_rate integer, membranes_status text, notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pregnancy_id uuid NOT NULL REFERENCES demo.pregnancies(id), admission_id uuid REFERENCES demo.admissions(id), attendant_id uuid REFERENCES demo.users(id), delivery_time timestamptz NOT NULL, mode text NOT NULL, outcome text NOT NULL, complications text, blood_loss_ml integer, notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.newborns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id uuid NOT NULL REFERENCES demo.deliveries(id), baby_patient_id uuid REFERENCES demo.patients(id), sex text NOT NULL, birth_weight_grams integer, apgar_1_min integer, apgar_5_min integer, apgar_10_min integer, resuscitation_required boolean NOT NULL DEFAULT false, status text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.postnatal_visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pregnancy_id uuid NOT NULL REFERENCES demo.pregnancies(id), encounter_id uuid REFERENCES demo.encounters(id), clinician_id uuid REFERENCES demo.users(id), visit_date date NOT NULL, mother_condition text NOT NULL, newborn_condition text, feeding_status text, danger_signs text, plan text NOT NULL,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.icu_admissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), accepted_by uuid REFERENCES demo.users(id), icu_bed_id uuid REFERENCES demo.beds(id), admitted_to_icu_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL, severity_score integer, status text NOT NULL, discharged_from_icu_at timestamptz,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.icu_observations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), icu_admission_id uuid NOT NULL REFERENCES demo.icu_admissions(id), recorded_at timestamptz NOT NULL DEFAULT now(), heart_rate integer, respiratory_rate integer, bp_systolic integer, bp_diastolic integer, spo2 integer, gcs integer, notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.ventilator_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), icu_admission_id uuid NOT NULL REFERENCES demo.icu_admissions(id), recorded_at timestamptz NOT NULL DEFAULT now(), mode text NOT NULL, fio2 integer, peep integer, tidal_volume integer, notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.fluid_balance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), icu_admission_id uuid NOT NULL REFERENCES demo.icu_admissions(id), recorded_at timestamptz NOT NULL DEFAULT now(), input_volume_ml integer, output_volume_ml integer, net_balance_ml integer, notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.icu_rounds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), icu_admission_id uuid NOT NULL REFERENCES demo.icu_admissions(id), clinician_id uuid REFERENCES demo.users(id), round_time timestamptz NOT NULL DEFAULT now(), assessment text NOT NULL, plan text NOT NULL, escalation_decision text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.hdu_admissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admission_id uuid NOT NULL REFERENCES demo.admissions(id), accepted_by uuid REFERENCES demo.users(id), hdu_bed_id uuid REFERENCES demo.beds(id), admitted_to_hdu_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL, status text NOT NULL, discharged_from_hdu_at timestamptz,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.hdu_observations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hdu_admission_id uuid NOT NULL REFERENCES demo.hdu_admissions(id), recorded_at timestamptz NOT NULL DEFAULT now(), heart_rate integer, respiratory_rate integer, bp_systolic integer, bp_diastolic integer, spo2 integer, oxygen_support text, escalation_required boolean NOT NULL DEFAULT false, notes text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo.hdu_rounds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hdu_admission_id uuid NOT NULL REFERENCES demo.hdu_admissions(id), clinician_id uuid REFERENCES demo.users(id), round_time timestamptz NOT NULL DEFAULT now(), assessment text NOT NULL, plan text NOT NULL, escalation_decision text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )`);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('theatres','read','theatres:read','Read theatres'), ('theatres','manage','theatres:manage','Manage theatres'),
        ('surgical_procedures','read','surgical_procedures:read','Read surgical procedures'), ('surgical_procedures','manage','surgical_procedures:manage','Manage surgical procedures'),
        ('surgery_bookings','create','surgery_bookings:create','Create surgery bookings'), ('surgery_bookings','read','surgery_bookings:read','Read surgery bookings'), ('surgery_bookings','update','surgery_bookings:update','Update surgery bookings'),
        ('surgery_staff','assign','surgery_staff:assign','Assign surgery staff'), ('surgery_notes','create','surgery_notes:create','Create surgery notes'), ('surgery_complications','create','surgery_complications:create','Create surgery complications'),
        ('pregnancies','create','pregnancies:create','Register pregnancies'), ('pregnancies','read','pregnancies:read','Read pregnancies'), ('pregnancies','update','pregnancies:update','Update pregnancies'),
        ('anc_visits','create','anc_visits:create','Create ANC visits'), ('labour_records','create','labour_records:create','Create labour records'), ('deliveries','create','deliveries:create','Create deliveries'), ('newborns','create','newborns:create','Create newborns'), ('postnatal_visits','create','postnatal_visits:create','Create postnatal visits'),
        ('icu_admissions','create','icu_admissions:create','Create ICU admissions'), ('icu_admissions','read','icu_admissions:read','Read ICU admissions'), ('icu_admissions','update','icu_admissions:update','Update ICU admissions'),
        ('icu_observations','create','icu_observations:create','Create ICU observations'), ('ventilator_records','create','ventilator_records:create','Create ventilator records'), ('fluid_balance','create','fluid_balance:create','Create fluid balance'), ('icu_rounds','create','icu_rounds:create','Create ICU rounds'),
        ('hdu_admissions','create','hdu_admissions:create','Create HDU admissions'), ('hdu_admissions','read','hdu_admissions:read','Read HDU admissions'), ('hdu_admissions','update','hdu_admissions:update','Update HDU admissions'),
        ('hdu_observations','create','hdu_observations:create','Create HDU observations'), ('hdu_rounds','create','hdu_rounds:create','Create HDU rounds')
      ON CONFLICT (resource, action) DO NOTHING
    `);
    await queryRunner.query(`INSERT INTO demo.role_permissions (role_id, permission_id) SELECT r.id, p.id FROM demo.roles r CROSS JOIN demo.permissions p WHERE r.name = 'administrator' ON CONFLICT DO NOTHING`);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'theatres:read','surgical_procedures:read','surgery_bookings:create','surgery_bookings:read','surgery_bookings:update','surgery_staff:assign','surgery_notes:create','surgery_complications:create',
        'pregnancies:create','pregnancies:read','pregnancies:update','anc_visits:create','labour_records:create','deliveries:create','newborns:create','postnatal_visits:create',
        'icu_admissions:create','icu_admissions:read','icu_admissions:update','icu_observations:create','ventilator_records:create','fluid_balance:create','icu_rounds:create',
        'hdu_admissions:create','hdu_admissions:read','hdu_admissions:update','hdu_observations:create','hdu_rounds:create'
      ) WHERE r.name = 'doctor' ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM demo.roles r JOIN demo.permissions p ON p.permission_key IN (
        'surgery_bookings:read','surgery_notes:create','pregnancies:read','anc_visits:create','labour_records:create','deliveries:create','newborns:create','postnatal_visits:create',
        'icu_admissions:read','icu_observations:create','ventilator_records:create','fluid_balance:create','hdu_admissions:read','hdu_observations:create'
      ) WHERE r.name = 'nurse' ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.hdu_rounds CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.hdu_observations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.hdu_admissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.icu_rounds CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.fluid_balance CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.ventilator_records CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.icu_observations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.icu_admissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.postnatal_visits CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.newborns CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.deliveries CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.labour_records CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.anc_visits CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.pregnancies CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.surgery_complications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.surgery_notes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.surgery_staff CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.surgery_bookings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.surgical_procedures CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.theatres CASCADE`);
  }
}
