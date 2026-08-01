import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Switch login tenant code to jalaram (schema stays demo for TypeORM entities).
 * Retire DEMO-/generic clinical numbers in favour of JH-* hospital references.
 */
export class JalaramTenantAndNumbering1767400000000 implements MigrationInterface {
  name = 'JalaramTenantAndNumbering1767400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.tenants
      SET code = 'jalaram',
          subdomain = 'jalaram',
          name = COALESCE(NULLIF(TRIM(name), ''), 'Jalaram Hospital')
      WHERE code = 'demo' OR subdomain = 'demo'
    `);

    await queryRunner.query(`
      UPDATE demo.patients
      SET patient_no = regexp_replace(patient_no, '^(DEMO|AFYA)-', 'JH-')
      WHERE patient_no ~ '^(DEMO|AFYA)-'
    `);

    await queryRunner.query(`
      UPDATE demo.patients
      SET qr_code = 'jalaram:patient:' || patient_no
      WHERE qr_code IS NOT NULL AND (qr_code LIKE 'afyasasa:patient:%' OR qr_code LIKE 'jalaram:patient:%')
    `);

    await queryRunner.query(`
      UPDATE demo.encounters
      SET encounter_no = 'JH-' || encounter_no
      WHERE encounter_no ~ '^(OPD|IPD|ED|LAB)-'
        AND encounter_no NOT LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.admissions
      SET admission_no = 'JH-' || admission_no
      WHERE admission_no ~ '^(ADM|IPD)-'
        AND admission_no NOT LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.lab_requests
      SET request_no = 'JH-' || request_no
      WHERE request_no LIKE 'LAB-%'
        AND request_no NOT LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.lab_samples
      SET barcode = 'JH-' || barcode
      WHERE barcode LIKE 'SMP-%'
        AND barcode NOT LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.radiology_requests
      SET request_no = 'JH-' || request_no
      WHERE request_no LIKE 'RAD-%'
        AND request_no NOT LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.pregnancies
      SET pregnancy_no = 'JH-' || pregnancy_no
      WHERE pregnancy_no LIKE 'PREG-%'
        AND pregnancy_no NOT LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE public.settings
      SET patient_id_prefix = 'JH'
      WHERE patient_id_prefix IN ('AFYA', 'DEMO', 'demo')
         OR patient_id_prefix IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.tenants
      SET code = 'demo', subdomain = 'demo'
      WHERE code = 'jalaram'
    `);

    await queryRunner.query(`
      UPDATE demo.patients
      SET patient_no = regexp_replace(patient_no, '^JH-', 'DEMO-')
      WHERE patient_no LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.encounters
      SET encounter_no = regexp_replace(encounter_no, '^JH-', '')
      WHERE encounter_no LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.admissions
      SET admission_no = regexp_replace(admission_no, '^JH-', '')
      WHERE admission_no LIKE 'JH-%'
    `);

    await queryRunner.query(`
      UPDATE demo.lab_requests
      SET request_no = regexp_replace(request_no, '^JH-', '')
      WHERE request_no LIKE 'JH-LAB-%'
    `);

    await queryRunner.query(`
      UPDATE demo.lab_samples
      SET barcode = regexp_replace(barcode, '^JH-', '')
      WHERE barcode LIKE 'JH-SMP-%'
    `);

    await queryRunner.query(`
      UPDATE demo.radiology_requests
      SET request_no = regexp_replace(request_no, '^JH-', '')
      WHERE request_no LIKE 'JH-RAD-%'
    `);

    await queryRunner.query(`
      UPDATE demo.pregnancies
      SET pregnancy_no = regexp_replace(pregnancy_no, '^JH-', '')
      WHERE pregnancy_no LIKE 'JH-PREG-%'
    `);
  }
}
