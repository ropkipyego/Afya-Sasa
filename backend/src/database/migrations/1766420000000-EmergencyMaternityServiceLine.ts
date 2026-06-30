import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmergencyMaternityServiceLine1766420000000 implements MigrationInterface {
  name = 'EmergencyMaternityServiceLine1766420000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE demo.emergency_encounters
        ADD COLUMN IF NOT EXISTS triage_category text,
        ADD COLUMN IF NOT EXISTS workflow_stage text NOT NULL DEFAULT 'arrival',
        ADD COLUMN IF NOT EXISTS outcome text,
        ADD COLUMN IF NOT EXISTS assigned_clinician_id uuid REFERENCES demo.users(id),
        ADD COLUMN IF NOT EXISTS bay_id uuid,
        ADD COLUMN IF NOT EXISTS observation_started_at timestamptz,
        ADD COLUMN IF NOT EXISTS disposition_notes text,
        ADD COLUMN IF NOT EXISTS chief_complaint text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.emergency_treatment_bays (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        bay_type text NOT NULL DEFAULT 'treatment',
        status text NOT NULL DEFAULT 'available',
        sort_order integer NOT NULL DEFAULT 0,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      ALTER TABLE demo.emergency_encounters
        ADD CONSTRAINT fk_emergency_bay
        FOREIGN KEY (bay_id) REFERENCES demo.emergency_treatment_bays(id)
        DEFERRABLE INITIALLY DEFERRED
    `).catch(() => undefined);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.emergency_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        emergency_id uuid NOT NULL REFERENCES demo.emergency_encounters(id),
        note_type text NOT NULL DEFAULT 'clinical',
        body text NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.emergency_observation_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        emergency_id uuid NOT NULL REFERENCES demo.emergency_encounters(id),
        vitals_summary text,
        nursing_notes text,
        doctor_review text,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      INSERT INTO demo.emergency_treatment_bays (name, code, bay_type, sort_order)
      VALUES
        ('Bay 1', 'ED-BAY-1', 'treatment', 1),
        ('Bay 2', 'ED-BAY-2', 'treatment', 2),
        ('Bay 3', 'ED-BAY-3', 'treatment', 3),
        ('Resuscitation Room', 'ED-RESUS', 'resuscitation', 4),
        ('Observation Area', 'ED-OBS', 'observation', 5)
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE demo.anc_visits
        ADD COLUMN IF NOT EXISTS weight_kg numeric,
        ADD COLUMN IF NOT EXISTS bp_systolic integer,
        ADD COLUMN IF NOT EXISTS bp_diastolic integer,
        ADD COLUMN IF NOT EXISTS fetal_heart_rate integer,
        ADD COLUMN IF NOT EXISTS fundal_height_cm numeric,
        ADD COLUMN IF NOT EXISTS ultrasound_summary text
    `);

    await queryRunner.query(`
      ALTER TABLE demo.newborns
        ADD COLUMN IF NOT EXISTS temp_name text,
        ADD COLUMN IF NOT EXISTS baby_name text,
        ADD COLUMN IF NOT EXISTS birth_order integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS multiple_birth text NOT NULL DEFAULT 'singleton',
        ADD COLUMN IF NOT EXISTS renamed_at timestamptz
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.partograph_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pregnancy_id uuid NOT NULL REFERENCES demo.pregnancies(id),
        recorded_at timestamptz NOT NULL DEFAULT now(),
        cervical_dilation_cm numeric,
        contractions_per_10min integer,
        contraction_duration_sec integer,
        fetal_heart_rate integer,
        maternal_pulse integer,
        bp_systolic integer,
        bp_diastolic integer,
        temperature_c numeric,
        liquor_status text,
        moulding text,
        descent text,
        alert_flag boolean NOT NULL DEFAULT false,
        alert_message text,
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.mother_baby_links (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mother_patient_id uuid NOT NULL REFERENCES demo.patients(id),
        baby_patient_id uuid NOT NULL REFERENCES demo.patients(id),
        newborn_id uuid REFERENCES demo.newborns(id),
        delivery_id uuid REFERENCES demo.deliveries(id),
        birth_date date NOT NULL,
        delivery_type text NOT NULL,
        birth_order integer NOT NULL DEFAULT 1,
        multiple_birth text NOT NULL DEFAULT 'singleton',
        status text NOT NULL DEFAULT 'active',
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        UNIQUE(mother_patient_id, baby_patient_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.maternity_unit_admissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        unit text NOT NULL,
        pregnancy_id uuid REFERENCES demo.pregnancies(id),
        newborn_id uuid REFERENCES demo.newborns(id),
        admitted_at timestamptz NOT NULL DEFAULT now(),
        discharged_at timestamptz,
        status text NOT NULL DEFAULT 'active',
        clinical_summary text,
        feeding_status text,
        oxygen_support text,
        incubator_status text,
        weight_grams integer,
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      ALTER TABLE demo.wards
        ADD COLUMN IF NOT EXISTS service_line text NOT NULL DEFAULT 'general'
    `);

    await queryRunner.query(`
      INSERT INTO demo.wards (name, code, type, floor, bed_count, active, service_line)
      VALUES
        ('ANC Clinic', 'MAT-ANC', 'maternity', 'Ground', 20, true, 'maternity'),
        ('Labour Ward', 'MAT-LABOUR', 'maternity', '1st', 12, true, 'maternity'),
        ('Postnatal Ward', 'MAT-POSTNATAL', 'maternity', '1st', 24, true, 'maternity'),
        ('Nursery', 'MAT-NURSERY', 'maternity', '1st', 16, true, 'maternity'),
        ('NICU', 'MAT-NICU', 'maternity', '2nd', 8, true, 'maternity')
      ON CONFLICT (code) DO UPDATE SET service_line = EXCLUDED.service_line
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('emergency_bays', 'read', 'emergency_bays:read', 'Read emergency treatment bays'),
        ('emergency_bays', 'manage', 'emergency_bays:manage', 'Manage emergency treatment bays'),
        ('mother_baby_links', 'read', 'mother_baby_links:read', 'Read mother-baby registry'),
        ('mother_baby_links', 'create', 'mother_baby_links:create', 'Create mother-baby links'),
        ('partograph', 'read', 'partograph:read', 'Read partograph entries'),
        ('partograph', 'create', 'partograph:create', 'Create partograph entries'),
        ('maternity_units', 'read', 'maternity_units:read', 'Read maternity unit admissions'),
        ('maternity_units', 'manage', 'maternity_units:manage', 'Manage maternity unit admissions')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name IN ('admin', 'doctor', 'nurse')
        AND p.permission_key IN (
          'emergency_bays:read', 'emergency_bays:manage',
          'mother_baby_links:read', 'mother_baby_links:create',
          'partograph:read', 'partograph:create',
          'maternity_units:read', 'maternity_units:manage'
        )
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.maternity_unit_admissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.mother_baby_links`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.partograph_entries`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.emergency_observation_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.emergency_notes`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.emergency_treatment_bays`);
  }
}
