import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { User } from '../core/core.entities';

@Entity({ name: 'clinical_orders', schema: 'demo' })
@Index(['status', 'sourceModule', 'orderedAt'])
export class ClinicalOrder extends SoftDeleteClinicalEntity {
  @Column({ name: 'order_no', type: 'varchar', unique: true })
  orderNo!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @Column({ name: 'order_type', type: 'varchar' })
  orderType!: 'laboratory' | 'radiology' | 'referral' | 'procedure' | 'pharmacy';

  @Column({ name: 'source_module', type: 'varchar' })
  sourceModule!: string;

  @Column({ name: 'source_record_id', type: 'uuid' })
  sourceRecordId!: string;

  @Column({ type: 'varchar', default: 'requested' })
  status!: string;

  @Column({ type: 'varchar', default: 'routine' })
  priority!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ordered_by' })
  orderedBy!: User | null;

  @Column({ name: 'ordered_at', type: 'timestamptz', default: () => 'now()' })
  orderedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
