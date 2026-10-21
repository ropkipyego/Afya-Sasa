import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unit-level blood bank ledger. Not pharmacy lots. Not applied automatically.
 * TYPEORM_MIGRATIONS_RUN must stay false. Duplicate unit_no must be scanned before apply.
 */
export class BloodBankUnits1771000000003 implements MigrationInterface {
  name = 'BloodBankUnits1771000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS demo.blood_bank_units (
        id uuid PRIMARY KEY,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        unit_no varchar NOT NULL UNIQUE,
        product varchar NOT NULL,
        blood_group varchar NOT NULL,
        collected_at timestamptz NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        screening_status varchar NOT NULL DEFAULT 'awaiting_screening',
        status varchar NOT NULL DEFAULT 'received',
        location varchar NULL,
        reserved_request_id uuid NULL,
        issued_request_id uuid NULL,
        issued_at timestamptz NULL,
        last_reason text NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_blood_bank_units_status
        ON demo.blood_bank_units (status, screening_status)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS demo.blood_bank_units`);
  }
}
