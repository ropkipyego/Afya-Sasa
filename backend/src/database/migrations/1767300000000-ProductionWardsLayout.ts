import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production ward layout for Jalaram:
 * Paediatrics, Surgical Private Suites, General Male, General Female.
 * Leaves existing maternity/HDU/ICU wards in place.
 */
export class ProductionWardsLayout1767300000000 implements MigrationInterface {
  name = 'ProductionWardsLayout1767300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename legacy single "General Ward" if still present
    await queryRunner.query(`
      UPDATE demo.wards
      SET name = 'General Ward — Male',
          code = 'GEN-M',
          type = 'general',
          updated_at = now()
      WHERE code = 'GEN' AND name = 'General Ward'
    `);

    await queryRunner.query(`
      INSERT INTO demo.wards (id, name, code, type, floor, bed_count, active)
      VALUES
        ('40000000-0000-4000-8000-000000000010', 'General Ward — Female', 'GEN-F', 'general', '1', 6, true),
        ('40000000-0000-4000-8000-000000000011', 'Paediatrics', 'PEDS', 'paediatric', '1', 6, true),
        ('40000000-0000-4000-8000-000000000012', 'Surgical Private Suites', 'SURG-PVT', 'surgical', '2', 4, true)
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            type = EXCLUDED.type,
            active = true,
            updated_at = now()
    `);

    await queryRunner.query(`
      INSERT INTO demo.beds (id, ward_id, bed_no, type, status, version)
      VALUES
        ('41000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000010', 'GEN-F-01', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000102', '40000000-0000-4000-8000-000000000010', 'GEN-F-02', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000103', '40000000-0000-4000-8000-000000000010', 'GEN-F-03', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000104', '40000000-0000-4000-8000-000000000010', 'GEN-F-04', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000105', '40000000-0000-4000-8000-000000000010', 'GEN-F-05', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000106', '40000000-0000-4000-8000-000000000010', 'GEN-F-06', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000111', '40000000-0000-4000-8000-000000000011', 'PEDS-01', 'paediatric', 'available', 1),
        ('41000000-0000-4000-8000-000000000112', '40000000-0000-4000-8000-000000000011', 'PEDS-02', 'paediatric', 'available', 1),
        ('41000000-0000-4000-8000-000000000113', '40000000-0000-4000-8000-000000000011', 'PEDS-03', 'paediatric', 'available', 1),
        ('41000000-0000-4000-8000-000000000114', '40000000-0000-4000-8000-000000000011', 'PEDS-04', 'paediatric', 'available', 1),
        ('41000000-0000-4000-8000-000000000115', '40000000-0000-4000-8000-000000000011', 'PEDS-05', 'paediatric', 'available', 1),
        ('41000000-0000-4000-8000-000000000116', '40000000-0000-4000-8000-000000000011', 'PEDS-06', 'paediatric', 'available', 1),
        ('41000000-0000-4000-8000-000000000121', '40000000-0000-4000-8000-000000000012', 'PVT-01', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000122', '40000000-0000-4000-8000-000000000012', 'PVT-02', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000123', '40000000-0000-4000-8000-000000000012', 'PVT-03', 'standard', 'available', 1),
        ('41000000-0000-4000-8000-000000000124', '40000000-0000-4000-8000-000000000012', 'PVT-04', 'standard', 'available', 1)
      ON CONFLICT (ward_id, bed_no) DO NOTHING
    `);

    // Ensure male general ward still has available beds if renamed from GEN
    await queryRunner.query(`
      INSERT INTO demo.beds (id, ward_id, bed_no, type, status, version)
      SELECT
        '41000000-0000-4000-8000-000000000131',
        w.id,
        'GEN-M-05',
        'standard',
        'available',
        1
      FROM demo.wards w
      WHERE w.code IN ('GEN-M', 'GEN')
      ON CONFLICT (ward_id, bed_no) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM demo.beds WHERE id IN (
        '41000000-0000-4000-8000-000000000101',
        '41000000-0000-4000-8000-000000000102',
        '41000000-0000-4000-8000-000000000103',
        '41000000-0000-4000-8000-000000000104',
        '41000000-0000-4000-8000-000000000105',
        '41000000-0000-4000-8000-000000000106',
        '41000000-0000-4000-8000-000000000111',
        '41000000-0000-4000-8000-000000000112',
        '41000000-0000-4000-8000-000000000113',
        '41000000-0000-4000-8000-000000000114',
        '41000000-0000-4000-8000-000000000115',
        '41000000-0000-4000-8000-000000000116',
        '41000000-0000-4000-8000-000000000121',
        '41000000-0000-4000-8000-000000000122',
        '41000000-0000-4000-8000-000000000123',
        '41000000-0000-4000-8000-000000000124',
        '41000000-0000-4000-8000-000000000131'
      )
    `);
    await queryRunner.query(`
      DELETE FROM demo.wards WHERE code IN ('GEN-F', 'PEDS', 'SURG-PVT')
    `);
  }
}
