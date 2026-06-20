import { MigrationInterface, QueryRunner } from 'typeorm';

export class DemoOperationalSeed1766228400000 implements MigrationInterface {
  name = 'DemoOperationalSeed1766228400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.users (
        id, employee_no, first_name, last_name, email, phone, password_hash, active, force_password_change
      )
      VALUES
        ('20000000-0000-4000-8000-000000000002', 'DOC-001', 'Demo', 'Doctor', 'doctor@demo.afyasasa.local', '+254700000001', '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa', true, false),
        ('20000000-0000-4000-8000-000000000003', 'NUR-001', 'Demo', 'Nurse', 'nurse@demo.afyasasa.local', '+254700000002', '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa', true, false),
        ('20000000-0000-4000-8000-000000000004', 'REC-001', 'Demo', 'Records', 'records@demo.afyasasa.local', '+254700000003', '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa', true, false),
        ('20000000-0000-4000-8000-000000000005', 'LAB-001', 'Demo', 'Lab', 'lab@demo.afyasasa.local', '+254700000004', '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa', true, false),
        ('20000000-0000-4000-8000-000000000006', 'RAD-001', 'Demo', 'Radiology', 'radiology@demo.afyasasa.local', '+254700000005', '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa', true, false)
      ON CONFLICT (email) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.user_roles (user_id, role_id)
      VALUES
        ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002'),
        ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003'),
        ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006'),
        ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004'),
        ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.patients (
        id, patient_no, first_name, middle_name, last_name, date_of_birth, gender, blood_group,
        primary_phone, secondary_phone, email, county, qr_code, registered_by
      )
      VALUES
        ('30000000-0000-4000-8000-000000000001', 'AFYA-2026-00001', 'Amina', NULL, 'Otieno', '1991-04-12', 'female', 'O+', '+254711111111', NULL, 'amina@example.com', 'Nairobi', 'afyasasa:patient:AFYA-2026-00001', '20000000-0000-4000-8000-000000000004'),
        ('30000000-0000-4000-8000-000000000002', 'AFYA-2026-00002', 'Brian', NULL, 'Kiptoo', '1984-09-02', 'male', 'A+', '+254722222222', NULL, 'brian@example.com', 'Nakuru', 'afyasasa:patient:AFYA-2026-00002', '20000000-0000-4000-8000-000000000004'),
        ('30000000-0000-4000-8000-000000000003', 'AFYA-2026-00003', 'Grace', NULL, 'Wanjiku', '1975-12-20', 'female', 'B+', '+254733333333', NULL, 'grace@example.com', 'Kiambu', 'afyasasa:patient:AFYA-2026-00003', '20000000-0000-4000-8000-000000000004')
      ON CONFLICT (patient_no) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.patient_identifiers (patient_id, type, value, verified, is_primary)
      VALUES
        ('30000000-0000-4000-8000-000000000001', 'national_id', 'DEMO-ID-0001', true, true),
        ('30000000-0000-4000-8000-000000000002', 'national_id', 'DEMO-ID-0002', true, true),
        ('30000000-0000-4000-8000-000000000003', 'sha', 'DEMO-SHA-0003', true, true)
      ON CONFLICT (type, value) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.patient_allergies (patient_id, allergen, type, reaction, severity, notes)
      VALUES
        ('30000000-0000-4000-8000-000000000001', 'Penicillin', 'drug', 'Rash and wheeze', 'severe', 'Demo allergy for patient safety banner')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.patient_chronic_conditions (patient_id, name, icd10_code, status, notes)
      VALUES
        ('30000000-0000-4000-8000-000000000002', 'Hypertension', 'I10', 'controlled', 'Demo chronic condition'),
        ('30000000-0000-4000-8000-000000000003', 'Diabetes mellitus', 'E11', 'active', 'Demo chronic condition')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.wards (id, name, code, type, floor, bed_count, active)
      VALUES
        ('40000000-0000-4000-8000-000000000001', 'General Ward', 'GEN', 'general', '1', 4, true),
        ('40000000-0000-4000-8000-000000000002', 'High Dependency Unit', 'HDU', 'hdu', '2', 2, true),
        ('40000000-0000-4000-8000-000000000003', 'Maternity Ward', 'MAT', 'maternity', '1', 2, true)
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.beds (id, ward_id, bed_no, type, status, version)
      VALUES
        ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'GEN-01', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'GEN-02', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'GEN-03', 'standard', 'cleaning', 1),
        ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'GEN-04', 'standard', 'maintenance', 1),
        ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000002', 'HDU-01', 'icu', 'available', 1),
        ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000002', 'HDU-02', 'icu', 'available', 1),
        ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000003', 'MAT-01', 'maternity', 'available', 1),
        ('41000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000003', 'MAT-02', 'maternity', 'available', 1)
      ON CONFLICT (ward_id, bed_no) DO NOTHING
    `);
  }

  async down(): Promise<void> {
    // Demo seed data is intentionally left in place for local development resets.
  }
}
