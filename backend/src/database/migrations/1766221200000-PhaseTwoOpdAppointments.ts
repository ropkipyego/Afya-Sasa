import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseTwoOpdAppointments1766221200000
  implements MigrationInterface
{
  name = 'PhaseTwoOpdAppointments1766221200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.encounters (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_no text NOT NULL UNIQUE,
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        type text NOT NULL,
        status text NOT NULL,
        attending_doctor_id uuid REFERENCES demo.users(id),
        presenting_complaint text NOT NULL,
        visit_type text,
        referral_source text,
        referral_reason text,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.triage_assessments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
        performed_by uuid REFERENCES demo.users(id),
        category text NOT NULL,
        colour text NOT NULL,
        chief_complaint text NOT NULL,
        pain_score integer,
        temperature numeric,
        pulse integer,
        respiratory_rate integer,
        bp_systolic integer,
        bp_diastolic integer,
        spo2 integer,
        weight numeric,
        height numeric,
        is_retriage boolean NOT NULL DEFAULT false,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.consultations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
        doctor_id uuid REFERENCES demo.users(id),
        subjective text NOT NULL,
        objective text NOT NULL,
        assessment text NOT NULL,
        plan text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        follow_up_date date,
        follow_up_instructions text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.encounter_diagnoses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
        icd10_code text,
        description text NOT NULL,
        type text NOT NULL,
        confirmed boolean NOT NULL DEFAULT false,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.clinical_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
        amends_note_id uuid REFERENCES demo.clinical_notes(id),
        type text NOT NULL,
        body text NOT NULL,
        amendment_reason text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.encounter_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id uuid NOT NULL REFERENCES demo.encounters(id),
        filename text NOT NULL,
        mime_type text NOT NULL,
        file_size integer NOT NULL,
        storage_path text NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.appointment_slots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id uuid NOT NULL REFERENCES demo.users(id),
        date date NOT NULL,
        start_time text NOT NULL,
        end_time text NOT NULL,
        max_patients integer NOT NULL DEFAULT 1,
        available boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.appointments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        doctor_id uuid NOT NULL REFERENCES demo.users(id),
        slot_id uuid REFERENCES demo.appointment_slots(id),
        appointment_date date NOT NULL,
        appointment_time text NOT NULL,
        type text NOT NULL,
        reason text NOT NULL,
        status text NOT NULL,
        source_encounter_id uuid REFERENCES demo.encounters(id),
        linked_encounter_id uuid REFERENCES demo.encounters(id),
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_encounters_status ON demo.encounters(type, status, started_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_triage_priority ON demo.triage_assessments(colour, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON demo.appointments(appointment_date, status)`);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('encounters', 'create', 'encounters:create', 'Create OPD encounters'),
        ('encounters', 'read', 'encounters:read', 'Read OPD encounters'),
        ('encounters', 'update', 'encounters:update', 'Update OPD encounters'),
        ('triage', 'create', 'triage:create', 'Record triage'),
        ('triage', 'read', 'triage:read', 'Read triage queues'),
        ('consultations', 'create', 'consultations:create', 'Create consultations'),
        ('consultations', 'read', 'consultations:read', 'Read consultations'),
        ('consultations', 'update', 'consultations:update', 'Update consultations'),
        ('diagnoses', 'create', 'diagnoses:create', 'Create encounter diagnoses'),
        ('clinical_notes', 'create', 'clinical_notes:create', 'Create immutable clinical notes'),
        ('encounter_attachments', 'create', 'encounter_attachments:create', 'Create attachment references'),
        ('appointments', 'read', 'appointments:read', 'Read appointments'),
        ('appointments', 'manage', 'appointments:manage', 'Manage appointments'),
        ('reports', 'read', 'reports:read', 'Read clinical reports')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'encounters:create','encounters:read','encounters:update',
        'triage:create','triage:read','consultations:read','appointments:read'
      )
      WHERE r.name = 'nurse'
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'patients:read','encounters:read','encounters:update',
        'consultations:create','consultations:read','consultations:update',
        'diagnoses:create','clinical_notes:create','encounter_attachments:create',
        'appointments:read','appointments:manage','reports:read'
      )
      WHERE r.name = 'doctor'
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key IN (
        'encounters:create','encounters:read','appointments:read','appointments:manage'
      )
      WHERE r.name = 'records_officer'
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.appointments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.appointment_slots CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.encounter_attachments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.clinical_notes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.encounter_diagnoses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.consultations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.triage_assessments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.encounters CASCADE`);
  }
}
