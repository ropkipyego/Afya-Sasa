import { Column, Entity } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import type { BloodBankProduct } from './blood-bank.entities';
import type { BloodUnitScreening, BloodUnitStatus } from './blood-bank-stock';

@Entity({ name: 'blood_bank_units', schema: 'demo' })
export class BloodBankUnit extends SoftDeleteClinicalEntity {
  @Column({ name: 'unit_no', type: 'varchar', unique: true })
  unitNo!: string;

  @Column({ type: 'varchar' })
  product!: BloodBankProduct;

  @Column({ name: 'blood_group', type: 'varchar' })
  bloodGroup!: string;

  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true })
  collectedAt!: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'screening_status', type: 'varchar', default: 'awaiting_screening' })
  screeningStatus!: BloodUnitScreening;

  @Column({ type: 'varchar', default: 'received' })
  status!: BloodUnitStatus;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ name: 'reserved_request_id', type: 'uuid', nullable: true })
  reservedRequestId!: string | null;

  @Column({ name: 'issued_request_id', type: 'uuid', nullable: true })
  issuedRequestId!: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastReason!: string | null;
}
