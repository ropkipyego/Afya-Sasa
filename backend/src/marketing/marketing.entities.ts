import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';

@Entity({ name: 'marketing_visits', schema: 'demo' })
@Index(['activityDate'])
@Index(['facilityName'])
@Index(['location'])
@Index(['outcome'])
@Index(['followUpDate'])
export class MarketingVisit extends SoftDeleteClinicalEntity {
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'owner_user_id' })
  owner!: User;

  @Column({ name: 'activity_date', type: 'date' })
  activityDate!: string;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ name: 'facility_name', type: 'varchar' })
  facilityName!: string;

  @Column({ name: 'contact_person', type: 'varchar', nullable: true })
  contactPerson!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  purpose!: string | null;

  @Column({ name: 'activity_type', type: 'varchar' })
  activityType!: string;

  @Column({ name: 'services_promoted', type: 'text', nullable: true })
  servicesPromoted!: string | null;

  @Column({ name: 'people_reached', type: 'int', default: 0 })
  peopleReached!: number;

  @Column({ name: 'leads_generated', type: 'int', default: 0 })
  leadsGenerated!: number;

  @Column({ name: 'referrals_generated', type: 'int', default: 0 })
  referralsGenerated!: number;

  @Column({ name: 'follow_up_required', type: 'boolean', default: false })
  followUpRequired!: boolean;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate!: string | null;

  @Column({ name: 'follow_up_completed', type: 'boolean', default: false })
  followUpCompleted!: boolean;

  @Column({ type: 'varchar', nullable: true })
  outcome!: string | null;

  @Column({ name: 'next_action', type: 'text', nullable: true })
  nextAction!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
