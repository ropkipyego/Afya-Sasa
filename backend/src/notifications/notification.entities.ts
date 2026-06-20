import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';

export type NotificationChannel = 'sms' | 'internal' | 'email';

@Entity({ name: 'notification_templates', schema: 'demo' })
@Index(['key', 'channel'], { unique: true })
export class NotificationTemplate extends AuditableEntity {
  @Column()
  key!: string;

  @Column()
  channel!: NotificationChannel;

  @Column({ nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;
}

@Entity({ name: 'notification_queue', schema: 'demo' })
@Index(['channel', 'sentAt'])
export class NotificationQueueEntry extends AuditableEntity {
  @Column()
  recipient!: string;

  @Column()
  channel!: NotificationChannel;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ nullable: true })
  error!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}

@Entity({ name: 'sms_logs', schema: 'demo' })
export class SmsLog extends AuditableEntity {
  @ManyToOne(() => NotificationQueueEntry)
  @JoinColumn({ name: 'queue_id' })
  queueEntry!: NotificationQueueEntry;

  @Column()
  provider!: string;

  @Column({ name: 'provider_message_id', nullable: true })
  providerMessageId!: string | null;

  @Column()
  destination!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ name: 'delivery_status', nullable: true })
  deliveryStatus!: string | null;

  @Column({ nullable: true })
  error!: string | null;

  @Column({ type: 'numeric', nullable: true })
  cost!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;
}

@Entity({ name: 'internal_notifications', schema: 'demo' })
@Index(['recipientId', 'readAt'])
export class InternalNotification extends AuditableEntity {
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: User | null;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column()
  severity!: 'info' | 'warning' | 'critical';

  @Column({ nullable: true })
  link!: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
