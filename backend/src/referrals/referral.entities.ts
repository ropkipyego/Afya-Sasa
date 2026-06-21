import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'referrals', schema: 'demo' })
@Index(['status', 'type'])
export class Referral extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'referring_doctor_id' })
  referringDoctor!: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'receiving_user_id' })
  receivingUser!: User | null;

  @Column({ type: 'varchar' })
  type!: 'internal' | 'external';

  @Column({ type: 'varchar', name: 'target_department', nullable: true })
  targetDepartment!: string | null;

  @Column({ type: 'varchar', name: 'target_facility', nullable: true })
  targetFacility!: string | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text' })
  letter!: string;

  @Column({ type: 'varchar' })
  status!: 'draft' | 'sent' | 'accepted' | 'completed' | 'cancelled';
}
