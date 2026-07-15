import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseATenantProvisioning1766800000000 implements MigrationInterface {
  name = 'PhaseATenantProvisioning1766800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.clone_tenant_schema(source_schema text, dest_schema text)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      DECLARE
        tbl text;
        idx record;
        fk record;
      BEGIN
        IF source_schema !~ '^[a-z][a-z0-9_]*$' OR dest_schema !~ '^[a-z][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid schema name';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.schemata WHERE schema_name = dest_schema
        ) THEN
          RAISE EXCEPTION 'Schema % already exists', dest_schema;
        END IF;

        EXECUTE format('CREATE SCHEMA %I', dest_schema);

        FOR tbl IN
          SELECT tablename FROM pg_tables WHERE schemaname = source_schema
        LOOP
          EXECUTE format(
            'CREATE TABLE %I.%I (LIKE %I.%I INCLUDING ALL)',
            dest_schema, tbl, source_schema, tbl
          );
        END LOOP;

        FOR idx IN
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = source_schema
            AND indexname NOT LIKE '%_pkey'
        LOOP
          EXECUTE replace(
            replace(idx.indexdef, source_schema || '.', dest_schema || '.'),
            'CREATE INDEX',
            'CREATE INDEX IF NOT EXISTS'
          );
        END LOOP;

        FOR fk IN
          SELECT
            tc.table_name,
            tc.constraint_name,
            pg_get_constraintdef(c.oid) AS def
          FROM information_schema.table_constraints tc
          JOIN pg_constraint c ON c.conname = tc.constraint_name
          JOIN pg_namespace n ON n.oid = c.connamespace AND n.nspname = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = source_schema
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
            dest_schema,
            fk.table_name,
            fk.constraint_name,
            replace(fk.def, source_schema || '.', dest_schema || '.')
          );
        END LOOP;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.seed_tenant_rbac(source_schema text, dest_schema text)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF source_schema !~ '^[a-z][a-z0-9_]*$' OR dest_schema !~ '^[a-z][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid schema name';
        END IF;

        EXECUTE format(
          'INSERT INTO %I.roles SELECT * FROM %I.roles',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.permissions SELECT * FROM %I.permissions',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.role_permissions SELECT * FROM %I.role_permissions',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.departments SELECT * FROM %I.departments',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_panels SELECT * FROM %I.lab_panels',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.lab_tests SELECT * FROM %I.lab_tests',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.radiology_modalities SELECT * FROM %I.radiology_modalities',
          dest_schema, source_schema
        );
        EXECUTE format(
          'INSERT INTO %I.notification_templates SELECT * FROM %I.notification_templates',
          dest_schema, source_schema
        );
      END;
      $$;
    `);

    await queryRunner.query(`
      INSERT INTO demo.permissions (resource, action, permission_key, description)
      VALUES
        ('platform', 'tenants', 'platform:tenants', 'Provision and manage hospital tenants')
      ON CONFLICT (resource, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO demo.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM demo.roles r
      JOIN demo.permissions p ON p.permission_key = 'platform:tenants'
      WHERE r.name = 'administrator'
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.seed_tenant_rbac(text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.clone_tenant_schema(text, text)`);
  }
}
