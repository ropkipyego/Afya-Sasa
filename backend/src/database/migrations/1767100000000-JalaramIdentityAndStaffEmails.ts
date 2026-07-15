import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rebrand demo hospital users to Jalaram emails and hospital identity.
 * Primary admin: it@jalaram.co.ke (password unchanged).
 */
export class JalaramIdentityAndStaffEmails1767100000000 implements MigrationInterface {
  name = 'JalaramIdentityAndStaffEmails1767100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Prefer canonical admin email first
    await queryRunner.query(`
      UPDATE demo.users SET email = 'it@jalaram.co.ke', first_name = 'IT', last_name = 'Admin'
      WHERE email = 'admin@demo.afyasasa.local'
        AND NOT EXISTS (SELECT 1 FROM demo.users WHERE email = 'it@jalaram.co.ke')
    `);

    await queryRunner.query(`
      UPDATE demo.users AS u
      SET email = regexp_replace(u.email, '@demo\\.afyasasa\\.local$', '@jalaram.co.ke')
      WHERE u.email LIKE '%@demo.afyasasa.local'
        AND NOT EXISTS (
          SELECT 1
          FROM demo.users AS x
          WHERE x.email = regexp_replace(u.email, '@demo\\.afyasasa\\.local$', '@jalaram.co.ke')
        )
    `);

    await queryRunner.query(`
      UPDATE public.tenants
      SET name = 'Jalaram Hospital',
          updated_at = now()
      WHERE code = 'demo'
    `);

    await queryRunner.query(`
      UPDATE public.settings
      SET sms_sender_name = COALESCE(NULLIF(sms_sender_name, ''), 'JALARAM'),
          clinical_catalog = COALESCE(clinical_catalog, '{}'::jsonb) || jsonb_build_object(
            'hospitalProfile', COALESCE(clinical_catalog->'hospitalProfile', '{}'::jsonb) || jsonb_build_object(
              'facilityName', 'Jalaram Hospital',
              'shortName', 'Jalaram',
              'contactEmail', 'it@jalaram.co.ke',
              'primaryColor', '#0d9488'
            )
          ),
          updated_at = now()
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE code = 'demo')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE demo.users SET email = 'admin@demo.afyasasa.local' WHERE email = 'it@jalaram.co.ke'
    `);
    await queryRunner.query(`
      UPDATE demo.users SET email = 'doctor@demo.afyasasa.local' WHERE email = 'doctor@jalaram.co.ke'
    `);
    await queryRunner.query(`
      UPDATE demo.users SET email = 'nurse@demo.afyasasa.local' WHERE email = 'nurse@jalaram.co.ke'
    `);
    await queryRunner.query(`
      UPDATE demo.users SET email = 'records@demo.afyasasa.local' WHERE email = 'records@jalaram.co.ke'
    `);
    await queryRunner.query(`
      UPDATE demo.users SET email = 'lab@demo.afyasasa.local' WHERE email = 'lab@jalaram.co.ke'
    `);
    await queryRunner.query(`
      UPDATE demo.users SET email = 'radiology@demo.afyasasa.local' WHERE email = 'radiology@jalaram.co.ke'
    `);
  }
}
