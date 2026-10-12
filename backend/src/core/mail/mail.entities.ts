import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { MailPurpose, MailTransportStatus } from './mail.types';

@Entity({ name: 'email_deliveries', schema: 'demo' })
@Index(['purpose', 'createdAt'])
export class EmailDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', unique: true })
  idempotencyKey!: string;

  @Column({ type: 'varchar' })
  purpose!: MailPurpose;

  @Column({ name: 'recipient_fingerprint', type: 'varchar' })
  recipientFingerprint!: string;

  @Column({ name: 'recipient_domain', type: 'varchar' })
  recipientDomain!: string;

  @Column({ type: 'varchar' })
  subject!: string;

  @Column({ type: 'varchar' })
  status!: MailTransportStatus | 'QUEUED' | 'ACCEPTED';

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error_safe', type: 'varchar', nullable: true })
  lastErrorSafe!: string | null;

  @Column({ name: 'provider_message_id', type: 'varchar', nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'report_deliveries', schema: 'demo' })
@Index(['tokenHash'], { unique: true })
export class ReportDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  workflow!: 'internal' | 'government';

  @Column({ name: 'report_type', type: 'varchar' })
  reportType!: string;

  @Column({ name: 'export_scope', type: 'varchar' })
  exportScope!: 'aggregate' | 'patient_level';

  @Column({ name: 'date_from', type: 'date', nullable: true })
  dateFrom!: string | null;

  @Column({ name: 'date_to', type: 'date', nullable: true })
  dateTo!: string | null;

  @Column({ name: 'requester_user_id', type: 'uuid' })
  requesterUserId!: string;

  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId!: string | null;

  @Column({ name: 'recipient_fingerprint', type: 'varchar' })
  recipientFingerprint!: string;

  @Column({ name: 'token_hash', type: 'varchar' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @Column({ name: 'email_delivery_id', type: 'uuid', nullable: true })
  emailDeliveryId!: string | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
