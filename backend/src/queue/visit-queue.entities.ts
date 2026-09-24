import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

export type VisitQueueType =
  | 'OPD'
  | 'LAB'
  | 'RAD'
  | 'PHARM'
  | 'CASH'
  | 'ED'
  | 'IPD'
  | 'THEATRE'
  | 'MAT'
  | 'ICU'
  | 'HDU';

export type VisitQueueStatus =
  | 'WAITING'
  | 'CALLED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'TRANSFERRED';

@Entity({ name: 'visit_queue_items', schema: 'demo' })
@Index(['queueType', 'tokenDate', 'status'])
export class VisitQueueItem extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @Column({ type: 'varchar', name: 'queue_type' })
  queueType!: VisitQueueType;

  @Column({ type: 'varchar' })
  token!: string;

  @Column({ type: 'date', name: 'token_date' })
  tokenDate!: string;

  @Column({ type: 'varchar', default: 'WAITING' })
  status!: VisitQueueStatus;

  @Column({ type: 'uuid', name: 'service_entity_id', nullable: true })
  serviceEntityId!: string | null;

  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
