import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Admission, Bed } from '../inpatient/inpatient.entities';

@Entity({ name: 'hdu_admissions', schema: 'demo' })
@Index(['status'])
export class HduAdmission extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accepted_by' })
  acceptedBy!: User | null;

  @ManyToOne(() => Bed, { nullable: true })
  @JoinColumn({ name: 'hdu_bed_id' })
  hduBed!: Bed | null;

  @Column({ name: 'admitted_to_hdu_at', type: 'timestamptz', default: () => 'now()' })
  admittedToHduAt!: Date;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar' })
  status!: 'active' | 'transferred_out' | 'discharged' | 'died';

  @Column({ name: 'discharged_from_hdu_at', type: 'timestamptz', nullable: true })
  dischargedFromHduAt!: Date | null;
}

@Entity({ name: 'hdu_observations', schema: 'demo' })
export class HduObservation extends SoftDeleteClinicalEntity {
  @ManyToOne(() => HduAdmission)
  @JoinColumn({ name: 'hdu_admission_id' })
  hduAdmission!: HduAdmission;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;

  @Column({ type: 'int',  nullable: true })
  heartRate!: number | null;

  @Column({ type: 'int',  nullable: true })
  respiratoryRate!: number | null;

  @Column({ type: 'int',  nullable: true })
  bpSystolic!: number | null;

  @Column({ type: 'int',  nullable: true })
  bpDiastolic!: number | null;

  @Column({ type: 'int',  nullable: true })
  spo2!: number | null;

  @Column({ type: 'varchar',  name: 'oxygen_support', nullable: true })
  oxygenSupport!: string | null;

  @Column({ type: 'boolean',  name: 'escalation_required', default: false })
  escalationRequired!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'hdu_rounds', schema: 'demo' })
export class HduRound extends SoftDeleteClinicalEntity {
  @ManyToOne(() => HduAdmission)
  @JoinColumn({ name: 'hdu_admission_id' })
  hduAdmission!: HduAdmission;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'clinician_id' })
  clinician!: User | null;

  @Column({ name: 'round_time', type: 'timestamptz', default: () => 'now()' })
  roundTime!: Date;

  @Column({ type: 'text' })
  assessment!: string;

  @Column({ type: 'text' })
  plan!: string;

  @Column({ name: 'escalation_decision', type: 'text', nullable: true })
  escalationDecision!: string | null;
}
