import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';

export type PaymentServiceLine =
  | 'consultation'
  | 'pharmacy'
  | 'laboratory'
  | 'radiology'
  | 'inpatient'
  | 'other';

@Entity({ name: 'payment_transactions', schema: 'demo' })
@Index(['status', 'method'])
export class PaymentTransaction extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => LabRequest, { nullable: true })
  @JoinColumn({ name: 'lab_request_id' })
  labRequest!: LabRequest | null;

  @Column({ type: 'varchar', name: 'service_line', nullable: true })
  serviceLine!: PaymentServiceLine | null;

  @Column({ type: 'uuid', name: 'service_entity_id', nullable: true })
  serviceEntityId!: string | null;

  @Column({ type: 'varchar', name: 'service_description', nullable: true })
  serviceDescription!: string | null;

  @Column({ type: 'varchar' })
  method!: 'cash' | 'mpesa' | 'card' | 'insurance' | 'quickbooks' | 'waived';

  @Column({ type: 'varchar', name: 'payer_scheme', nullable: true })
  payerScheme!: string | null;

  @Column({ type: 'numeric', nullable: true })
  amount!: string | null;

  @Column({ type: 'varchar', default: 'KES' })
  currency!: string;

  @Column({ type: 'varchar' })
  status!: 'pending' | 'initiated' | 'completed' | 'failed' | 'cancelled';

  @Column({ type: 'varchar', name: 'external_reference', nullable: true })
  externalReference!: string | null;

  @Column({ type: 'varchar', name: 'mpesa_phone', nullable: true })
  mpesaPhone!: string | null;

  @Column({ type: 'jsonb', name: 'raw_callback', nullable: true })
  rawCallback!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}

@Entity({ name: 'quickbooks_sync_queue', schema: 'demo' })
@Index(['status', 'entityType'])
export class QuickbooksSyncQueueItem extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', name: 'entity_type' })
  entityType!: 'encounter' | 'lab_request' | 'payment';

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'varchar' })
  action!: 'customer_add' | 'invoice_add' | 'payment_add';

  @Column({ type: 'jsonb', default: () => `'{}'` })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar' })
  status!: 'pending' | 'synced' | 'failed';

  @Column({ type: 'varchar', name: 'quickbooks_txn_id', nullable: true })
  quickbooksTxnId!: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt!: Date | null;
}
