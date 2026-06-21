import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Patient } from '../patients/patient.entities';
import { User } from '../core/core.entities';

export type EncounterType = 'opd' | 'emergency' | 'inpatient';
export type OpdEncounterStatus =
  | 'registered'
  | 'triaged'
  | 'in_consultation'
  | 'awaiting_results'
  | 'admitted'
  | 'completed';

@Entity({ name: 'encounters', schema: 'demo' })
@Index(['encounterNo'], { unique: true })
@Index(['type', 'status', 'startedAt'])
export class Encounter extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar',  name: 'encounter_no' })
  encounterNo!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar' })
  type!: EncounterType;

  @Column({ type: 'varchar' })
  status!: OpdEncounterStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attending_doctor_id' })
  attendingDoctor!: User | null;

  @Column({ name: 'presenting_complaint', type: 'text' })
  presentingComplaint!: string;

  @Column({ type: 'varchar',  name: 'visit_type', nullable: true })
  visitType!: 'new' | 'follow_up' | 'referral' | null;

  @Column({ type: 'varchar',  name: 'referral_source', nullable: true })
  referralSource!: string | null;

  @Column({ name: 'referral_reason', type: 'text', nullable: true })
  referralReason!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}

@Entity({ name: 'triage_assessments', schema: 'demo' })
@Index(['colour', 'createdAt'])
export class TriageAssessment extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedBy!: User | null;

  @Column({ type: 'varchar' })
  category!: string;

  @Column({ type: 'varchar' })
  colour!: 'red' | 'orange' | 'yellow' | 'green' | 'blue';

  @Column({ name: 'chief_complaint', type: 'text' })
  chiefComplaint!: string;

  @Column({ type: 'int',  name: 'pain_score', nullable: true })
  painScore!: number | null;

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

  @Column({ type: 'boolean',  name: 'is_retriage', default: false })
  isRetriage!: boolean;
}

@Entity({ name: 'consultations', schema: 'demo' })
export class Consultation extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: User | null;

  @Column({ type: 'text' })
  subjective!: string;

  @Column({ type: 'text' })
  objective!: string;

  @Column({ type: 'text' })
  assessment!: string;

  @Column({ type: 'text' })
  plan!: string;

  @Column({ type: 'varchar',  default: 'draft' })
  status!: 'draft' | 'completed';

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate!: string | null;

  @Column({ name: 'follow_up_instructions', type: 'text', nullable: true })
  followUpInstructions!: string | null;
}

@Entity({ name: 'encounter_diagnoses', schema: 'demo' })
export class EncounterDiagnosis extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ type: 'varchar',  name: 'icd10_code', nullable: true })
  icd10Code!: string | null;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'varchar' })
  type!: 'primary' | 'secondary' | 'differential';

  @Column({ type: 'boolean',  default: false })
  confirmed!: boolean;
}

@Entity({ name: 'clinical_notes', schema: 'demo' })
export class ClinicalNote extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @ManyToOne(() => ClinicalNote, { nullable: true })
  @JoinColumn({ name: 'amends_note_id' })
  amendsNote!: ClinicalNote | null;

  @Column({ type: 'varchar' })
  type!: 'doctor' | 'nursing' | 'progress' | 'procedure' | 'handover' | 'referral' | 'discharge';

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'amendment_reason', type: 'text', nullable: true })
  amendmentReason!: string | null;
}

@Entity({ name: 'encounter_attachments', schema: 'demo' })
export class EncounterAttachment extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar',  name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'int',  name: 'file_size' })
  fileSize!: number;

  @Column({ type: 'varchar',  name: 'storage_path' })
  storagePath!: string;
}
