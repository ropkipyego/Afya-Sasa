import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseOneSafetyInvariants1766217600000
  implements MigrationInterface
{
  name = 'PhaseOneSafetyInvariants1766217600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION demo.prevent_audit_log_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs are append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_logs_no_update ON demo.audit_logs
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_logs_no_delete ON demo.audit_logs
    `);
    await queryRunner.query(`
      CREATE TRIGGER audit_logs_no_update
      BEFORE UPDATE ON demo.audit_logs
      FOR EACH ROW EXECUTE FUNCTION demo.prevent_audit_log_mutation()
    `);
    await queryRunner.query(`
      CREATE TRIGGER audit_logs_no_delete
      BEFORE DELETE ON demo.audit_logs
      FOR EACH ROW EXECUTE FUNCTION demo.prevent_audit_log_mutation()
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_name_search
      ON demo.patients (lower(first_name), lower(last_name))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_primary_phone
      ON demo.patients (primary_phone)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
      ON demo.notification_queue (channel, sent_at, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_record
      ON demo.audit_logs (record_type, record_id)
    `);

    await queryRunner.query(`
      INSERT INTO demo.notification_templates (key, channel, subject, body)
      VALUES (
        'patient_registered',
        'sms',
        NULL,
        'Welcome to AfyaSasa. Your patient number is {{patient_no}}.'
      )
      ON CONFLICT (key, channel) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_audit_logs_record`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS demo.idx_notification_queue_pending`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS demo.idx_patients_primary_phone`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_patients_name_search`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS audit_logs_no_delete ON demo.audit_logs`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS audit_logs_no_update ON demo.audit_logs`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS demo.prevent_audit_log_mutation`,
    );
  }
}
