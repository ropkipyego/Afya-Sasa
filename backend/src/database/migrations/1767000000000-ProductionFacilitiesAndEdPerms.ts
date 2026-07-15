import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grant ED bay/alert permissions to administrator role,
 * and seed Jalaram + City Clinic facilities into demo tenant settings.
 */
export class ProductionFacilitiesAndEdPerms1767000000000 implements MigrationInterface {
  name = 'ProductionFacilitiesAndEdPerms1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      CROSS JOIN demo.permissions p
      WHERE r.name = 'administrator'
        AND p.permission_key IN (
          'emergency_bays:read',
          'emergency_bays:manage',
          'critical_alerts:read',
          'critical_alerts:create',
          'critical_alerts:acknowledge'
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE public.settings
      SET clinical_catalog = COALESCE(clinical_catalog, '{}'::jsonb) || jsonb_build_object(
        'facilities', jsonb_build_array(
          jsonb_build_object(
            'id', 'main-hospital',
            'name', 'Jalaram Hospital',
            'shortName', 'Jalaram',
            'type', 'main',
            'active', true,
            'address', 'Nairobi',
            'modules', jsonb_build_object(
              'registration', true, 'opd', true, 'ipd', true, 'theatre', true,
              'icu', true, 'laboratory', true, 'radiology', true, 'maternity', true,
              'emergency', true, 'pharmacy', true, 'documents', true, 'reporting', true
            ),
            'brandingOverride', jsonb_build_object(
              'facilityName', 'Jalaram Hospital',
              'primaryColor', '#0d9488'
            )
          ),
          jsonb_build_object(
            'id', 'city-clinic',
            'name', 'City Clinic',
            'shortName', 'City',
            'type', 'clinic',
            'active', true,
            'address', 'City Clinic · Nairobi',
            'modules', jsonb_build_object(
              'registration', true, 'opd', true, 'ipd', false, 'theatre', false,
              'icu', false, 'laboratory', true, 'radiology', true, 'maternity', false,
              'emergency', true, 'pharmacy', false, 'documents', true, 'reporting', true
            ),
            'brandingOverride', jsonb_build_object(
              'facilityName', 'City Clinic',
              'primaryColor', '#0369a1'
            )
          )
        ),
        'hospitalProfile', COALESCE(clinical_catalog->'hospitalProfile', '{}'::jsonb) || jsonb_build_object(
          'facilityName', COALESCE(clinical_catalog->'hospitalProfile'->>'facilityName', 'Jalaram Hospital')
        )
      )
      WHERE tenant_id IN (SELECT id FROM public.tenants WHERE code = 'demo')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM demo.role_permissions rp
      USING demo.roles r, demo.permissions p
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
        AND r.name = 'administrator'
        AND p.permission_key IN (
          'emergency_bays:read',
          'emergency_bays:manage',
          'critical_alerts:read',
          'critical_alerts:create',
          'critical_alerts:acknowledge'
        )
    `);
  }
}
