import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Encounter } from '../opd/opd.entities';

@Entity({ name: 'emergency_encounters', schema: 'demo' })
@Index(['status'])
export class EmergencyEncounter extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ name: 'arrival_mode' })
  arrivalMode!: 'ambulance' | 'walk_in' | 'police' | 'referral' | 'airlift';

  @Column({ name: 'arrival_time', type: 'timestamptz', default: () => 'now()' })
  arrivalTime!: Date;

  @Column({ name: 'trauma_flag', default: false })
  traumaFlag!: boolean;

  @Column({ name: 'trauma_mechanism', type: 'text', nullable: true })
  traumaMechanism!: string | null;

  @Column()
  status!: 'registered' | 'triaged' | 'active' | 'stabilised' | 'disposed';

  @Column({ nullable: true })
  disposition!: 'admitted' | 'discharged' | 'transferred' | 'died' | 'left_without_being_seen' | null;

  @Column({ name: 'transfer_facility', nullable: true })
  transferFacility!: string | null;

  @Column({ name: 'resuscitation_flag', default: false })
  resuscitationFlag!: boolean;

  @Column({ name: 'resuscitation_notes', type: 'text', nullable: true })
  resuscitationNotes!: string | null;
}

@Entity({ name: 'critical_alerts', schema: 'demo' })
@Index(['severity', 'acknowledgedAt'])
export class CriticalAlert extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column()
  type!: 'critical_vitals' | 'allergy' | 'critical_lab' | 'drug_interaction' | 'code_blue';

  @Column()
  severity!: 'warning' | 'critical';

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy!: string | null;

  @Column({ name: 'is_auto', default: false })
  isAuto!: boolean;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy!: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;
}
