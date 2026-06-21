import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Ward } from '../inpatient/inpatient.entities';

@Entity({ name: 'vital_signs', schema: 'demo' })
export class VitalSigns extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @Column({ type: 'numeric', nullable: true })
  temperature!: string | null;

  @Column({ type: 'int',  nullable: true })
  pulse!: number | null;

  @Column({ type: 'int',  name: 'respiratory_rate', nullable: true })
  respiratoryRate!: number | null;

  @Column({ type: 'int',  name: 'bp_systolic', nullable: true })
  bpSystolic!: number | null;

  @Column({ type: 'int',  name: 'bp_diastolic', nullable: true })
  bpDiastolic!: number | null;

  @Column({ type: 'int',  nullable: true })
  spo2!: number | null;

  @Column({ type: 'numeric', nullable: true })
  weight!: string | null;

  @Column({ type: 'numeric', nullable: true })
  height!: string | null;

  @Column({ type: 'numeric', nullable: true })
  bmi!: string | null;

  @Column({ name: 'blood_glucose', type: 'numeric', nullable: true })
  bloodGlucose!: string | null;

  @Column({ type: 'int',  nullable: true })
  gcs!: number | null;

  @Column({ name: 'urine_output', type: 'numeric', nullable: true })
  urineOutput!: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;
}

@Entity({ name: 'medication_administration_records', schema: 'demo' })
export class MedicationAdministrationRecord extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @Column({ type: 'varchar',  name: 'medication_name' })
  medicationName!: string;

  @Column({ type: 'varchar',  name: 'generic_name', nullable: true })
  genericName!: string | null;

  @Column({ type: 'varchar' })
  dosage!: string;

  @Column({ type: 'varchar' })
  route!: 'oral' | 'iv' | 'im' | 'sc' | 'sl' | 'topical' | 'inhaled' | 'rectal' | 'nasal';

  @Column({ type: 'varchar' })
  frequency!: string;

  @Column({ name: 'scheduled_time', type: 'timestamptz' })
  scheduledTime!: Date;

  @Column({ name: 'actual_time', type: 'timestamptz', nullable: true })
  actualTime!: Date | null;

  @Column({ type: 'varchar' })
  status!: 'scheduled' | 'given' | 'withheld' | 'refused' | 'not_available';

  @Column({ name: 'withhold_reason', type: 'text', nullable: true })
  withholdReason!: string | null;
}

@Entity({ name: 'shift_notes', schema: 'demo' })
export class ShiftNote extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'ward_id' })
  ward!: Ward;

  @Column({ type: 'varchar' })
  shift!: 'morning' | 'afternoon' | 'night';

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar' })
  type!: 'handover' | 'incident' | 'general';

  @Column({ type: 'text' })
  body!: string;
}

@Entity({ name: 'nursing_observations', schema: 'demo' })
export class NursingObservation extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @Column({ type: 'varchar' })
  type!: 'fluid_intake' | 'fluid_output' | 'wound' | 'bowel' | 'urine_output' | 'pain' | 'neuro' | 'skin';

  @Column({ type: 'varchar' })
  value!: string;

  @Column({ type: 'varchar',  nullable: true })
  unit!: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;
}
