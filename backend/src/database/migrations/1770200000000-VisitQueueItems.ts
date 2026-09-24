import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visit/service queue tokens. Distinct from the permanent patient file number.
 * Apply via explicit SQL only — TYPEORM_MIGRATIONS_RUN must stay false.
 * Does not backfill historical encounters.
 */
export class VisitQueueItems1770200000000 implements MigrationInterface {
  name = 'VisitQueueItems1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.visit_queue_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        encounter_id uuid NULL REFERENCES demo.encounters(id),
        queue_type varchar NOT NULL,
        token varchar NOT NULL,
        token_date date NOT NULL,
        status varchar NOT NULL DEFAULT 'WAITING',
        service_entity_id uuid NULL,
        called_at timestamptz NULL,
        started_at timestamptz NULL,
        completed_at timestamptz NULL,
        metadata jsonb NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_queue_token_day
        ON demo.visit_queue_items (queue_type, token_date, token)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visit_queue_active
        ON demo.visit_queue_items (queue_type, token_date, status, created_at)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visit_queue_patient
        ON demo.visit_queue_items (patient_id, created_at DESC)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_visit_queue_patient`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_visit_queue_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.uq_visit_queue_token_day`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.visit_queue_items`);
  }
}
