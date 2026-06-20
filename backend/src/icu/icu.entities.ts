import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Admission, Bed } from '../inpatient/inpatient.entities';

@Entity({ name: 'icu_admissions', schema: 'demo' })
@Index(['status'])
export class IcuAdmission extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accepted_by' })
  acceptedBy!: User | null;

  @ManyToOne(() => Bed, { nullable: true })
  @JoinColumn({ name: 'icu_bed_id' })
  icuBed!: Bed | null;

  @Column({ name: 'admitted_to_icu_at', type: 'timestamptz', default: () => 'now()' })
  admittedToIcuAt!: Date;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'severity_score', nullable: true })
  severityScore!: number | null;

  @Column()
  status!: 'active' | 'transferred_out' | 'discharged' | 'died';

  @Column({ name: 'discharged_from_icu_at', type: 'timestamptz', nullable: true })
  dischargedFromIcuAt!: Date | null;
}

@Entity({ name: 'icu_observations', schema: 'demo' })
export class IcuObservation extends SoftDeleteClinicalEntity {
  @ManyToOne(() => IcuAdmission)
  @JoinColumn({ name: 'icu_admission_id' })
  icuAdmission!: IcuAdmission;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;

  @Column({ nullable: true })
  heartRate!: number | null;

  @Column({ nullable: true })
  respiratoryRate!: number | null;

  @Column({ nullable: true })
  bpSystolic!: number | null;

  @Column({ nullable: true })
  bpDiastolic!: number | null;

  @Column({ nullable: true })
  spo2!: number | null;

  @Column({ nullable: true })
  gcs!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'ventilator_records', schema: 'demo' })
export class VentilatorRecord extends SoftDeleteClinicalEntity {
  @ManyToOne(() => IcuAdmission)
  @JoinColumn({ name: 'icu_admission_id' })
  icuAdmission!: IcuAdmission;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;

  @Column()
  mode!: string;

  @Column({ nullable: true })
  fio2!: number | null;

  @Column({ nullable: true })
  peep!: number | null;

  @Column({ name: 'tidal_volume', nullable: true })
  tidalVolume!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'fluid_balance', schema: 'demo' })
export class FluidBalance extends SoftDeleteClinicalEntity {
  @ManyToOne(() => IcuAdmission)
  @JoinColumn({ name: 'icu_admission_id' })
  icuAdmission!: IcuAdmission;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;

  @Column({ name: 'input_volume_ml', nullable: true })
  inputVolumeMl!: number | null;

  @Column({ name: 'output_volume_ml', nullable: true })
  outputVolumeMl!: number | null;

  @Column({ name: 'net_balance_ml', nullable: true })
  netBalanceMl!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'icu_rounds', schema: 'demo' })
export class IcuRound extends SoftDeleteClinicalEntity {
  @ManyToOne(() => IcuAdmission)
  @JoinColumn({ name: 'icu_admission_id' })
  icuAdmission!: IcuAdmission;

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
