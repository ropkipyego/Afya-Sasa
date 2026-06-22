import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalCatalogSettings1766400000000 implements MigrationInterface {
  name = 'ClinicalCatalogSettings1766400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.settings
      ADD COLUMN IF NOT EXISTS clinical_catalog jsonb NOT NULL DEFAULT '{
        "clinics": ["General OPD", "Cardiology", "Orthopaedic", "Paediatrics", "ENT", "Dermatology", "Gynaecology", "Maternity"],
        "visitTypes": [
          {"value": "new", "label": "New visit"},
          {"value": "follow_up", "label": "Follow-up"},
          {"value": "referral", "label": "Referral"}
        ],
        "doctorCategories": ["Consultant", "Medical Officer", "Clinical Officer", "Specialist"],
        "assignableDoctors": [],
        "paymentMethods": [
          {"value": "cash", "label": "Cash"},
          {"value": "mpesa", "label": "M-Pesa"},
          {"value": "card", "label": "Card"},
          {"value": "insurance", "label": "Insurance"},
          {"value": "quickbooks", "label": "QuickBooks receipt"},
          {"value": "waived", "label": "Waived"}
        ]
      }'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.settings DROP COLUMN IF EXISTS clinical_catalog
    `);
  }
}
