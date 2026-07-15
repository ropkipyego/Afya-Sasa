import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../patients/patient.entities';
import { User } from '../core/core.entities';

@Entity({ name: 'notification_events', schema: 'demo' })
@Index(['recipientUserId', 'status', 'scheduledAt'])
export class NotificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType!: string;

  @Column({ type: 'varchar', default: 'in_app' })
  channel!: 'in_app' | 'email' | 'sms';

  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recipient_user_id' })
  recipientUser!: User | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient | null;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'delivered' | 'failed';

  @Column({ name: 'scheduled_at', type: 'timestamptz', default: () => 'now()' })
  scheduledAt!: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
