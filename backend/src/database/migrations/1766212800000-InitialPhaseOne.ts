import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPhaseOne1766212800000 implements MigrationInterface {
  name = 'InitialPhaseOne1766212800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS demo`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        schema_name text NOT NULL,
        subdomain text NOT NULL UNIQUE,
        address text,
        moh_facility_code text,
        licence_number text,
        active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        sms_sender_name text NOT NULL DEFAULT 'AfyaSasa',
        patient_id_prefix text NOT NULL DEFAULT 'AFYA',
        triage_system text NOT NULL DEFAULT 'manchester_ke',
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO public.tenants (id, name, code, schema_name, subdomain, address, moh_facility_code, licence_number)
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        'Demo Hospital',
        'demo',
        'demo',
        'demo',
        'Demo address',
        'DEMO-MOH',
        'DEMO-LICENCE'
      )
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO public.settings (tenant_id, sms_sender_name, patient_id_prefix, triage_system)
      VALUES ('00000000-0000-4000-8000-000000000001', 'AfyaSasa', 'AFYA', 'manchester_ke')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        label text NOT NULL,
        description text,
        is_system boolean NOT NULL DEFAULT false,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.permissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        resource text NOT NULL,
        action text NOT NULL,
        permission_key text NOT NULL,
        description text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (resource, action)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.role_permissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id uuid NOT NULL REFERENCES demo.roles(id) ON DELETE CASCADE,
        permission_id uuid NOT NULL REFERENCES demo.permissions(id) ON DELETE CASCADE,
        granted_by uuid,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (role_id, permission_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_no text NOT NULL UNIQUE,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text NOT NULL UNIQUE,
        phone text,
        password_hash text NOT NULL,
        specialisation text,
        kmpdc_licence text,
        active boolean NOT NULL DEFAULT true,
        force_password_change boolean NOT NULL DEFAULT true,
        last_login_at timestamptz,
        failed_login_attempts integer NOT NULL DEFAULT 0,
        locked_until timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES demo.users(id) ON DELETE CASCADE,
        role_id uuid NOT NULL REFERENCES demo.roles(id) ON DELETE CASCADE,
        granted_by uuid,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, role_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        token_hash text NOT NULL,
        device text,
        ip text,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.patients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_no text NOT NULL UNIQUE,
        first_name text NOT NULL,
        middle_name text,
        last_name text NOT NULL,
        date_of_birth date NOT NULL,
        gender text NOT NULL,
        blood_group text,
        nationality text,
        marital_status text,
        occupation text,
        religion text,
        education_level text,
        primary_phone text NOT NULL,
        secondary_phone text,
        email text,
        county text,
        sub_county text,
        ward text,
        village text,
        postal_address text,
        photo_url text,
        qr_code text NOT NULL,
        is_deceased boolean NOT NULL DEFAULT false,
        deceased_at date,
        biometric_enrolled boolean NOT NULL DEFAULT false,
        registered_by uuid,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.patient_identifiers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id) ON DELETE CASCADE,
        type text NOT NULL,
        value text NOT NULL,
        verified boolean NOT NULL DEFAULT false,
        is_primary boolean NOT NULL DEFAULT false,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        UNIQUE (type, value)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.patient_next_of_kin (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id) ON DELETE CASCADE,
        name text NOT NULL,
        relationship text NOT NULL,
        primary_phone text NOT NULL,
        secondary_phone text,
        email text,
        address text,
        is_emergency_contact boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.patient_allergies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id) ON DELETE CASCADE,
        allergen text NOT NULL,
        type text NOT NULL,
        reaction text NOT NULL,
        severity text NOT NULL,
        onset_date date,
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.patient_chronic_conditions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id) ON DELETE CASCADE,
        name text NOT NULL,
        icd10_code text,
        onset_date date,
        status text NOT NULL,
        notes text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.notification_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL,
        channel text NOT NULL,
        subject text,
        body text NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (key, channel)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.notification_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient text NOT NULL,
        channel text NOT NULL,
        content text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        last_attempt_at timestamptz,
        error text,
        sent_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.sms_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_id uuid REFERENCES demo.notification_queue(id),
        provider text NOT NULL,
        provider_message_id text,
        destination text NOT NULL,
        text text NOT NULL,
        delivery_status text,
        error text,
        cost numeric,
        sent_at timestamptz,
        delivered_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.internal_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id uuid,
        title text NOT NULL,
        body text NOT NULL,
        severity text NOT NULL,
        link text,
        read_at timestamptz,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        action text NOT NULL,
        record_type text,
        record_id text,
        before_json jsonb,
        after_json jsonb,
        ip text,
        user_agent text,
        session_id text,
        endpoint text NOT NULL,
        http_code integer NOT NULL,
        duration_ms integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO demo.roles (id, name, label, description, is_system)
      VALUES
        ('10000000-0000-4000-8000-000000000001', 'administrator', 'Administrator', 'Full system access', true),
        ('10000000-0000-4000-8000-000000000002', 'doctor', 'Doctor', 'Clinical consultation and inpatient care', true),
        ('10000000-0000-4000-8000-000000000003', 'nurse', 'Nurse', 'Triage and nursing workflows', true),
        ('10000000-0000-4000-8000-000000000004', 'lab_technician', 'Lab Technician', 'Laboratory workflows', true),
        ('10000000-0000-4000-8000-000000000005', 'radiology_technician', 'Radiology Technician', 'Radiology workflows', true),
        ('10000000-0000-4000-8000-000000000006', 'records_officer', 'Records Officer', 'Patient registration and appointments', true)
      ON CONFLICT (name) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('auth', 'change_password', 'auth:change_password', 'Change own password'),
        ('patients', 'create', 'patients:create', 'Register patients'),
        ('patients', 'read', 'patients:read', 'Read patient records'),
        ('patients', 'update', 'patients:update', 'Update patient demographics'),
        ('patients', 'delete', 'patients:delete', 'Soft delete patients'),
        ('patients', 'search', 'patients:search', 'Search patients'),
        ('patients', 'history', 'patients:history', 'View patient history'),
        ('patient_identifiers', 'manage', 'patient_identifiers:manage', 'Manage identifiers'),
        ('patient_allergies', 'manage', 'patient_allergies:manage', 'Manage allergies'),
        ('patient_chronic_conditions', 'manage', 'patient_chronic_conditions:manage', 'Manage chronic conditions'),
        ('patient_next_of_kin', 'manage', 'patient_next_of_kin:manage', 'Manage next of kin'),
        ('users', 'manage', 'users:manage', 'Manage users'),
        ('roles', 'manage', 'roles:manage', 'Manage roles'),
        ('audit_logs', 'read', 'audit_logs:read', 'Read audit logs'),
        ('settings', 'manage', 'settings:manage', 'Manage settings')
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
      JOIN demo.permissions p ON p.permission_key IN ('patients:create', 'patients:read', 'patients:update', 'patients:search', 'patients:history')
      WHERE r.name = 'records_officer'
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.users (
        id,
        employee_no,
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        active,
        force_password_change
      )
      VALUES (
        '20000000-0000-4000-8000-000000000001',
        'ADM-001',
        'Demo',
        'Admin',
        'admin@demo.afyasasa.local',
        '+254700000000',
        '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa',
        true,
        true
      )
      ON CONFLICT (email) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.user_roles (user_id, role_id)
      VALUES ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS demo CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.settings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.tenants CASCADE`);
  }
}
