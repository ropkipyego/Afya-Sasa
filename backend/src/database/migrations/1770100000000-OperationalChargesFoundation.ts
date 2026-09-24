import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Operational charges — NOT a general ledger.
 * Applied 2026-09-23 on live demo schema via explicit SQL (not TYPEORM_MIGRATIONS_RUN).
 * TYPEORM_MIGRATIONS_RUN must stay false so marketing/reorder migrations stay unapplied.
 *
 * Preserves existing payment_transactions (nullable charge_id).
 * Does not backfill the 2 live payments or 7 historical pharmacy orders.
 */
export class OperationalChargesFoundation1770100000000 implements MigrationInterface {
  name = 'OperationalChargesFoundation1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.charges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES demo.patients(id),
        encounter_id uuid NULL REFERENCES demo.encounters(id),
        service_line varchar NOT NULL,
        service_entity_id uuid NULL,
        service_description varchar NOT NULL,
        amount_owed numeric NOT NULL CHECK (amount_owed >= 0),
        amount_paid numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
        amount_waived numeric NOT NULL DEFAULT 0 CHECK (amount_waived >= 0),
        currency varchar NOT NULL DEFAULT 'KES',
        status varchar NOT NULL DEFAULT 'owed',
        metadata jsonb NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_charges_patient_status
        ON demo.charges (patient_id, status, created_at DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_charges_service_entity_active
        ON demo.charges (service_line, service_entity_id)
        WHERE deleted_at IS NULL
          AND service_entity_id IS NOT NULL
          AND status NOT IN ('cancelled', 'waived')
    `);

    await queryRunner.query(`
      ALTER TABLE demo.payment_transactions
        ADD COLUMN IF NOT EXISTS charge_id uuid NULL REFERENCES demo.charges(id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_charge
        ON demo.payment_transactions (charge_id)
        WHERE deleted_at IS NULL AND charge_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_payment_transactions_charge`);
    await queryRunner.query(`
      ALTER TABLE demo.payment_transactions
        DROP COLUMN IF EXISTS charge_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.uq_charges_service_entity_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS demo.idx_charges_patient_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS demo.charges`);
  }
}
