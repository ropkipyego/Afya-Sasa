import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';

export type Gender = 'female' | 'male' | 'intersex' | 'unknown';
export type IdentifierType =
  | 'national_id'
  | 'sha'
  | 'passport'
  | 'birth_certificate'
  | 'refugee_id';

@Entity({ name: 'patients', schema: 'demo' })
@Index(['patientNo'], { unique: true })
@Index(['firstName', 'lastName'])
export class Patient extends SoftDeleteClinicalEntity {
  @Column({ name: 'patient_no' })
  patientNo!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName!: string | null;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: string;

  @Column()
  gender!: Gender;

  @Column({ name: 'blood_group', nullable: true })
  bloodGroup!: string | null;

  @Column({ nullable: true })
  nationality!: string | null;

  @Column({ name: 'marital_status', nullable: true })
  maritalStatus!: string | null;

  @Column({ nullable: true })
  occupation!: string | null;

  @Column({ nullable: true })
  religion!: string | null;

  @Column({ name: 'education_level', nullable: true })
  educationLevel!: string | null;

  @Column({ name: 'primary_phone' })
  primaryPhone!: string;

  @Column({ name: 'secondary_phone', nullable: true })
  secondaryPhone!: string | null;

  @Column({ nullable: true })
  email!: string | null;

  @Column({ nullable: true })
  county!: string | null;

  @Column({ name: 'sub_county', nullable: true })
  subCounty!: string | null;

  @Column({ nullable: true })
  ward!: string | null;

  @Column({ nullable: true })
  village!: string | null;

  @Column({ name: 'postal_address', nullable: true })
  postalAddress!: string | null;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl!: string | null;

  @Column({ name: 'qr_code' })
  qrCode!: string;

  @Column({ name: 'is_deceased', default: false })
  isDeceased!: boolean;

  @Column({ name: 'deceased_at', type: 'date', nullable: true })
  deceasedAt!: string | null;

  @Column({ name: 'biometric_enrolled', default: false })
  biometricEnrolled!: boolean;

  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy!: string | null;

  @OneToMany(() => PatientIdentifier, (identifier) => identifier.patient, {
    cascade: true,
  })
  identifiers!: PatientIdentifier[];

  @OneToMany(() => PatientNextOfKin, (nextOfKin) => nextOfKin.patient, {
    cascade: true,
  })
  nextOfKin!: PatientNextOfKin[];

  @OneToMany(() => PatientAllergy, (allergy) => allergy.patient)
  allergies!: PatientAllergy[];

  @OneToMany(() => PatientChronicCondition, (condition) => condition.patient)
  chronicConditions!: PatientChronicCondition[];
}

@Entity({ name: 'patient_identifiers', schema: 'demo' })
@Unique(['type', 'value'])
export class PatientIdentifier extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, (patient) => patient.identifiers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column()
  type!: IdentifierType;

  @Column()
  value!: string;

  @Column({ default: false })
  verified!: boolean;

  @Column({ name: 'is_primary', default: false })
  isPrimary!: boolean;
}

@Entity({ name: 'patient_next_of_kin', schema: 'demo' })
export class PatientNextOfKin extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, (patient) => patient.nextOfKin, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column()
  name!: string;

  @Column()
  relationship!: string;

  @Column({ name: 'primary_phone' })
  primaryPhone!: string;

  @Column({ name: 'secondary_phone', nullable: true })
  secondaryPhone!: string | null;

  @Column({ nullable: true })
  email!: string | null;

  @Column({ nullable: true })
  address!: string | null;

  @Column({ name: 'is_emergency_contact', default: false })
  isEmergencyContact!: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;
}

@Entity({ name: 'patient_allergies', schema: 'demo' })
export class PatientAllergy extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, (patient) => patient.allergies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column()
  allergen!: string;

  @Column()
  type!: 'drug' | 'food' | 'environmental' | 'latex' | 'contrast';

  @Column()
  reaction!: string;

  @Column()
  severity!: 'mild' | 'moderate' | 'severe' | 'life_threatening';

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

@Entity({ name: 'patient_chronic_conditions', schema: 'demo' })
export class PatientChronicCondition extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, (patient) => patient.chronicConditions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column()
  name!: string;

  @Column({ name: 'icd10_code', nullable: true })
  icd10Code!: string | null;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate!: string | null;

  @Column()
  status!: 'active' | 'controlled' | 'resolved';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
