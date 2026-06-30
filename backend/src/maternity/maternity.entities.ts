import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'pregnancies', schema: 'demo' })
@Index(['status'])
export class Pregnancy extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar',  name: 'pregnancy_no', unique: true })
  pregnancyNo!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'registration_encounter_id' })
  registrationEncounter!: Encounter | null;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @Column({ type: 'int' })
  gravida!: number;

  @Column({ type: 'int' })
  para!: number;

  @Column({ name: 'lmp_date', type: 'date', nullable: true })
  lmpDate!: string | null;

  @Column({ type: 'date', nullable: true })
  edd!: string | null;

  @Column({ type: 'varchar',  name: 'risk_level', default: 'low' })
  riskLevel!: 'low' | 'moderate' | 'high';

  @Column({ name: 'risk_notes', type: 'text', nullable: true })
  riskNotes!: string | null;

  @Column({ type: 'varchar',  default: 'active' })
  status!: 'active' | 'delivered' | 'ended' | 'transferred';
}

@Entity({ name: 'anc_visits', schema: 'demo' })
export class AncVisit extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Pregnancy)
  @JoinColumn({ name: 'pregnancy_id' })
  pregnancy!: Pregnancy;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'clinician_id' })
  clinician!: User | null;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate!: string;

  @Column({ type: 'int',  name: 'gestational_age_weeks', nullable: true })
  gestationalAgeWeeks!: number | null;

  @Column({ type: 'text', nullable: true })
  riskAssessment!: string | null;

  @Column({ type: 'text' })
  plan!: string;

  @Column({ type: 'numeric', name: 'weight_kg', nullable: true })
  weightKg!: string | null;

  @Column({ type: 'int', name: 'bp_systolic', nullable: true })
  bpSystolic!: number | null;

  @Column({ type: 'int', name: 'bp_diastolic', nullable: true })
  bpDiastolic!: number | null;

  @Column({ type: 'int', name: 'fetal_heart_rate', nullable: true })
  fetalHeartRate!: number | null;

  @Column({ type: 'numeric', name: 'fundal_height_cm', nullable: true })
  fundalHeightCm!: string | null;

  @Column({ name: 'ultrasound_summary', type: 'text', nullable: true })
  ultrasoundSummary!: string | null;
}

@Entity({ name: 'labour_records', schema: 'demo' })
export class LabourRecord extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Pregnancy)
  @JoinColumn({ name: 'pregnancy_id' })
  pregnancy!: Pregnancy;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;

  @Column({ name: 'cervical_dilation_cm', type: 'numeric', nullable: true })
  cervicalDilationCm!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  contractions!: string | null;

  @Column({ type: 'int',  name: 'fetal_heart_rate', nullable: true })
  fetalHeartRate!: number | null;

  @Column({ type: 'varchar',  name: 'membranes_status', nullable: true })
  membranesStatus!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'deliveries', schema: 'demo' })
export class Delivery extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Pregnancy)
  @JoinColumn({ name: 'pregnancy_id' })
  pregnancy!: Pregnancy;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attendant_id' })
  attendant!: User | null;

  @Column({ name: 'delivery_time', type: 'timestamptz' })
  deliveryTime!: Date;

  @Column({ type: 'varchar' })
  mode!: 'svd' | 'assisted' | 'cesarean' | 'breech';

  @Column({ type: 'varchar' })
  outcome!: 'live_birth' | 'stillbirth' | 'maternal_transfer' | 'maternal_death';

  @Column({ type: 'text', nullable: true })
  complications!: string | null;

  @Column({ type: 'int',  name: 'blood_loss_ml', nullable: true })
  bloodLossMl!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'newborns', schema: 'demo' })
export class Newborn extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Delivery)
  @JoinColumn({ name: 'delivery_id' })
  delivery!: Delivery;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'baby_patient_id' })
  babyPatient!: Patient | null;

  @Column({ type: 'varchar' })
  sex!: 'female' | 'male' | 'unknown';

  @Column({ type: 'int',  name: 'birth_weight_grams', nullable: true })
  birthWeightGrams!: number | null;

  @Column({ type: 'int',  name: 'apgar_1_min', nullable: true })
  apgar1Min!: number | null;

  @Column({ type: 'int',  name: 'apgar_5_min', nullable: true })
  apgar5Min!: number | null;

  @Column({ type: 'int',  name: 'apgar_10_min', nullable: true })
  apgar10Min!: number | null;

  @Column({ type: 'boolean',  name: 'resuscitation_required', default: false })
  resuscitationRequired!: boolean;

  @Column({ type: 'varchar' })
  status!: 'alive' | 'stillborn' | 'referred' | 'deceased';

  @Column({ name: 'temp_name', type: 'varchar', nullable: true })
  tempName!: string | null;

  @Column({ name: 'baby_name', type: 'varchar', nullable: true })
  babyName!: string | null;

  @Column({ type: 'int', name: 'birth_order', default: 1 })
  birthOrder!: number;

  @Column({ type: 'varchar', name: 'multiple_birth', default: 'singleton' })
  multipleBirth!: 'singleton' | 'twin' | 'triplet' | 'higher_order';

  @Column({ name: 'renamed_at', type: 'timestamptz', nullable: true })
  renamedAt!: Date | null;
}

@Entity({ name: 'partograph_entries', schema: 'demo' })
export class PartographEntry extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Pregnancy)
  @JoinColumn({ name: 'pregnancy_id' })
  pregnancy!: Pregnancy;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;

  @Column({ name: 'cervical_dilation_cm', type: 'numeric', nullable: true })
  cervicalDilationCm!: string | null;

  @Column({ type: 'int', name: 'contractions_per_10min', nullable: true })
  contractionsPer10Min!: number | null;

  @Column({ type: 'int', name: 'contraction_duration_sec', nullable: true })
  contractionDurationSec!: number | null;

  @Column({ type: 'int', name: 'fetal_heart_rate', nullable: true })
  fetalHeartRate!: number | null;

  @Column({ type: 'int', name: 'maternal_pulse', nullable: true })
  maternalPulse!: number | null;

  @Column({ type: 'int', name: 'bp_systolic', nullable: true })
  bpSystolic!: number | null;

  @Column({ type: 'int', name: 'bp_diastolic', nullable: true })
  bpDiastolic!: number | null;

  @Column({ type: 'numeric', name: 'temperature_c', nullable: true })
  temperatureC!: string | null;

  @Column({ name: 'liquor_status', type: 'varchar', nullable: true })
  liquorStatus!: string | null;

  @Column({ type: 'varchar', nullable: true })
  moulding!: string | null;

  @Column({ type: 'varchar', nullable: true })
  descent!: string | null;

  @Column({ type: 'boolean', name: 'alert_flag', default: false })
  alertFlag!: boolean;

  @Column({ name: 'alert_message', type: 'text', nullable: true })
  alertMessage!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'mother_baby_links', schema: 'demo' })
@Index(['motherPatient', 'babyPatient'], { unique: true })
export class MotherBabyLink extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'mother_patient_id' })
  motherPatient!: Patient;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'baby_patient_id' })
  babyPatient!: Patient;

  @ManyToOne(() => Newborn, { nullable: true })
  @JoinColumn({ name: 'newborn_id' })
  newborn!: Newborn | null;

  @ManyToOne(() => Delivery, { nullable: true })
  @JoinColumn({ name: 'delivery_id' })
  delivery!: Delivery | null;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate!: string;

  @Column({ name: 'delivery_type', type: 'varchar' })
  deliveryType!: string;

  @Column({ type: 'int', name: 'birth_order', default: 1 })
  birthOrder!: number;

  @Column({ type: 'varchar', name: 'multiple_birth', default: 'singleton' })
  multipleBirth!: 'singleton' | 'twin' | 'triplet' | 'higher_order';

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'separated' | 'deceased';
}

@Entity({ name: 'maternity_unit_admissions', schema: 'demo' })
export class MaternityUnitAdmission extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar' })
  unit!: 'anc' | 'labour' | 'postnatal' | 'nursery' | 'nicu';

  @ManyToOne(() => Pregnancy, { nullable: true })
  @JoinColumn({ name: 'pregnancy_id' })
  pregnancy!: Pregnancy | null;

  @ManyToOne(() => Newborn, { nullable: true })
  @JoinColumn({ name: 'newborn_id' })
  newborn!: Newborn | null;

  @Column({ name: 'admitted_at', type: 'timestamptz', default: () => 'now()' })
  admittedAt!: Date;

  @Column({ name: 'discharged_at', type: 'timestamptz', nullable: true })
  dischargedAt!: Date | null;

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'transferred' | 'discharged';

  @Column({ name: 'clinical_summary', type: 'text', nullable: true })
  clinicalSummary!: string | null;

  @Column({ name: 'feeding_status', type: 'varchar', nullable: true })
  feedingStatus!: string | null;

  @Column({ name: 'oxygen_support', type: 'varchar', nullable: true })
  oxygenSupport!: string | null;

  @Column({ name: 'incubator_status', type: 'varchar', nullable: true })
  incubatorStatus!: string | null;

  @Column({ type: 'int', name: 'weight_grams', nullable: true })
  weightGrams!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'postnatal_visits', schema: 'demo' })
export class PostnatalVisit extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Pregnancy)
  @JoinColumn({ name: 'pregnancy_id' })
  pregnancy!: Pregnancy;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'clinician_id' })
  clinician!: User | null;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate!: string;

  @Column({ name: 'mother_condition', type: 'text' })
  motherCondition!: string;

  @Column({ name: 'newborn_condition', type: 'text', nullable: true })
  newbornCondition!: string | null;

  @Column({ type: 'varchar',  name: 'feeding_status', nullable: true })
  feedingStatus!: string | null;

  @Column({ name: 'danger_signs', type: 'text', nullable: true })
  dangerSigns!: string | null;

  @Column({ type: 'text' })
  plan!: string;
}
