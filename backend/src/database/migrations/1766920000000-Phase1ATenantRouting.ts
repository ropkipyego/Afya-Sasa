import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1A — tenant routing helpers (schema-per-hospital).
 * Entities still use schema: 'demo' until TenantQuerySubscriber is verified in staging.
 */
export class Phase1ATenantRouting1766920000000 implements MigrationInterface {
  name = 'Phase1ATenantRouting1766920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.set_tenant_search_path(schema_name text)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF schema_name !~ '^[a-z][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid tenant schema name: %', schema_name;
        END IF;
        EXECUTE format('SET LOCAL search_path TO %I, public', schema_name);
      END;
      $$;
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION public.set_tenant_search_path(text) IS
        'Phase 1A: call at start of each DB transaction to route queries to the tenant schema.';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.set_tenant_search_path(text)`);
  }
}
