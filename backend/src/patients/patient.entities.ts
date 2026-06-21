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
  @Column({ type: 'varchar',  name: 'patient_no' })
  patientNo!: string;

  @Column({ type: 'varchar',  name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar',  name: 'middle_name', nullable: true })
  middleName!: string | null;

  @Column({ type: 'varchar',  name: 'last_name' })
  lastName!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: string;

  @Column({ type: 'varchar' })
  gender!: Gender;

  @Column({ type: 'varchar',  name: 'blood_group', nullable: true })
  bloodGroup!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  nationality!: string | null;

  @Column({ type: 'varchar',  name: 'marital_status', nullable: true })
  maritalStatus!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  occupation!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  religion!: string | null;

  @Column({ type: 'varchar',  name: 'education_level', nullable: true })
  educationLevel!: string | null;

  @Column({ type: 'varchar',  name: 'primary_phone' })
  primaryPhone!: string;

  @Column({ type: 'varchar',  name: 'secondary_phone', nullable: true })
  secondaryPhone!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  email!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  county!: string | null;

  @Column({ type: 'varchar',  name: 'sub_county', nullable: true })
  subCounty!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  ward!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  village!: string | null;

  @Column({ type: 'varchar',  name: 'postal_address', nullable: true })
  postalAddress!: string | null;

  @Column({ type: 'varchar',  name: 'photo_url', nullable: true })
  photoUrl!: string | null;

  @Column({ type: 'varchar',  name: 'qr_code' })
  qrCode!: string;

  @Column({ type: 'boolean',  name: 'is_deceased', default: false })
  isDeceased!: boolean;

  @Column({ name: 'deceased_at', type: 'date', nullable: true })
  deceasedAt!: string | null;

  @Column({ type: 'boolean',  name: 'biometric_enrolled', default: false })
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

  @Column({ type: 'varchar' })
  type!: IdentifierType;

  @Column({ type: 'varchar' })
  value!: string;

  @Column({ type: 'boolean',  default: false })
  verified!: boolean;

  @Column({ type: 'boolean',  name: 'is_primary', default: false })
  isPrimary!: boolean;
}

@Entity({ name: 'patient_next_of_kin', schema: 'demo' })
export class PatientNextOfKin extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, (patient) => patient.nextOfKin, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  relationship!: string;

  @Column({ type: 'varchar',  name: 'primary_phone' })
  primaryPhone!: string;

  @Column({ type: 'varchar',  name: 'secondary_phone', nullable: true })
  secondaryPhone!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  email!: string | null;

  @Column({ type: 'varchar',  nullable: true })
  address!: string | null;

  @Column({ type: 'boolean',  name: 'is_emergency_contact', default: false })
  isEmergencyContact!: boolean;

  @Column({ type: 'int',  name: 'sort_order', default: 0 })
  sortOrder!: number;
}

@Entity({ name: 'patient_allergies', schema: 'demo' })
export class PatientAllergy extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, (patient) => patient.allergies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar' })
  allergen!: string;

  @Column({ type: 'varchar' })
  type!: 'drug' | 'food' | 'environmental' | 'latex' | 'contrast';

  @Column({ type: 'varchar' })
  reaction!: string;

  @Column({ type: 'varchar' })
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

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar',  name: 'icd10_code', nullable: true })
  icd10Code!: string | null;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate!: string | null;

  @Column({ type: 'varchar' })
  status!: 'active' | 'controlled' | 'resolved';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
