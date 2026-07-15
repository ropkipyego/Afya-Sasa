import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures the demo administrator can always recover first-login access
 * after local password experiments. Does not affect other users.
 */
export class DemoAdminAccessRecovery1766910000000 implements MigrationInterface {
  name = 'DemoAdminAccessRecovery1766910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE demo.users
      SET
        password_hash = '$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa',
        force_password_change = true,
        failed_login_attempts = 0,
        locked_until = NULL,
        active = true
      WHERE email = 'admin@demo.afyasasa.local'
    `);
  }

  async down(): Promise<void> {
    // Intentionally no-op — recovery migration only.
  }
}
