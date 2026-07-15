import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rename leftover *@demo.afyasasa.local users to *@jalaram.co.ke when free.
 * Skip (and deactivate) rows whose target email already exists (e.g. it@demo vs it@jalaram).
 */
export class JalaramEmailCatchAll1767110000000 implements MigrationInterface {
  name = 'JalaramEmailCatchAll1767110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      UPDATE demo.users
      SET active = false,
          updated_at = now()
      WHERE email LIKE '%@demo.afyasasa.local'
    `);

    await queryRunner.query(`
      UPDATE demo.users SET first_name = 'IT', last_name = 'Admin'
      WHERE email = 'it@jalaram.co.ke'
    `);

    await queryRunner.query(`
      UPDATE public.settings
      SET sms_sender_name = COALESCE(NULLIF(sms_sender_name, ''), 'JALARAM'),
          clinical_catalog = COALESCE(clinical_catalog, '{}'::jsonb) || jsonb_build_object(
            'hospitalProfile', COALESCE(clinical_catalog->'hospitalProfile', '{}'::jsonb) || jsonb_build_object(
              'facilityName', 'Jalaram Hospital',
              'shortName', 'Jalaram',
              'contactEmail', 'it@jalaram.co.ke'
            )
          ),
          updated_at = now()
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE code = 'demo')
    `);
  }

  public async down(): Promise<void> {
    // irreversible safely (duplicate emails may have been deactivated)
  }
}
