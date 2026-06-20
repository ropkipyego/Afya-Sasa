import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'pregnancies', schema: 'demo' })
@Index(['status'])
export class Pregnancy extends SoftDeleteClinicalEntity {
  @Column({ name: 'pregnancy_no', unique: true })
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

  @Column()
  gravida!: number;

  @Column()
  para!: number;

  @Column({ name: 'lmp_date', type: 'date', nullable: true })
  lmpDate!: string | null;

  @Column({ type: 'date', nullable: true })
  edd!: string | null;

  @Column({ name: 'risk_level', default: 'low' })
  riskLevel!: 'low' | 'moderate' | 'high';

  @Column({ name: 'risk_notes', type: 'text', nullable: true })
  riskNotes!: string | null;

  @Column({ default: 'active' })
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

  @Column({ name: 'gestational_age_weeks', nullable: true })
  gestationalAgeWeeks!: number | null;

  @Column({ type: 'text', nullable: true })
  riskAssessment!: string | null;

  @Column({ type: 'text' })
  plan!: string;
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

  @Column({ nullable: true })
  contractions!: string | null;

  @Column({ name: 'fetal_heart_rate', nullable: true })
  fetalHeartRate!: number | null;

  @Column({ name: 'membranes_status', nullable: true })
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

  @Column()
  mode!: 'svd' | 'assisted' | 'cesarean' | 'breech';

  @Column()
  outcome!: 'live_birth' | 'stillbirth' | 'maternal_transfer' | 'maternal_death';

  @Column({ type: 'text', nullable: true })
  complications!: string | null;

  @Column({ name: 'blood_loss_ml', nullable: true })
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

  @Column()
  sex!: 'female' | 'male' | 'unknown';

  @Column({ name: 'birth_weight_grams', nullable: true })
  birthWeightGrams!: number | null;

  @Column({ name: 'apgar_1_min', nullable: true })
  apgar1Min!: number | null;

  @Column({ name: 'apgar_5_min', nullable: true })
  apgar5Min!: number | null;

  @Column({ name: 'apgar_10_min', nullable: true })
  apgar10Min!: number | null;

  @Column({ name: 'resuscitation_required', default: false })
  resuscitationRequired!: boolean;

  @Column()
  status!: 'alive' | 'stillborn' | 'referred' | 'deceased';
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

  @Column({ name: 'feeding_status', nullable: true })
  feedingStatus!: string | null;

  @Column({ name: 'danger_signs', type: 'text', nullable: true })
  dangerSigns!: string | null;

  @Column({ type: 'text' })
  plan!: string;
}
