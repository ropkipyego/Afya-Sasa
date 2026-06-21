import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'wards', schema: 'demo' })
@Unique(['code'])
export class Ward extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  type!:
    | 'general'
    | 'icu'
    | 'hdu'
    | 'maternity'
    | 'paediatric'
    | 'surgical'
    | 'medical'
    | 'isolation';

  @Column({ type: 'varchar',  nullable: true })
  floor!: string | null;

  @Column({ type: 'int',  name: 'bed_count', default: 0 })
  bedCount!: number;

  @Column({ type: 'boolean',  default: true })
  active!: boolean;
}

@Entity({ name: 'beds', schema: 'demo' })
@Unique(['ward', 'bedNo'])
@Index(['status'])
export class Bed extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'ward_id' })
  ward!: Ward;

  @Column({ type: 'varchar',  name: 'bed_no' })
  bedNo!: string;

  @Column({ type: 'varchar' })
  type!: 'standard' | 'icu' | 'isolation' | 'paediatric' | 'maternity' | 'cardiac';

  @Column({ type: 'varchar' })
  status!: 'available' | 'reserved' | 'occupied' | 'maintenance' | 'cleaning';

  @Column({ type: 'int',  default: 1 })
  version!: number;
}

@Entity({ name: 'admissions', schema: 'demo' })
@Index(['status'])
export class Admission extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar',  name: 'admission_no', unique: true })
  admissionNo!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => Bed)
  @JoinColumn({ name: 'bed_id' })
  bed!: Bed;

  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'ward_id' })
  ward!: Ward;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'admitting_doctor_id' })
  admittingDoctor!: User | null;

  @Column({ name: 'admitted_at', type: 'timestamptz', default: () => 'now()' })
  admittedAt!: Date;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar' })
  type!: 'elective' | 'emergency' | 'transfer';

  @Column({ type: 'varchar',  default: 'active' })
  status!: 'active' | 'discharged';

  @Column({ name: 'discharged_at', type: 'timestamptz', nullable: true })
  dischargedAt!: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'discharging_doctor_id' })
  dischargingDoctor!: User | null;

  @Column({ type: 'varchar',  name: 'condition_on_discharge', nullable: true })
  conditionOnDischarge!: 'improved' | 'same' | 'deteriorated' | 'died' | 'absconded' | null;

  @Column({ type: 'int',  name: 'length_of_stay_days', nullable: true })
  lengthOfStayDays!: number | null;
}

@Entity({ name: 'bed_transfer_log', schema: 'demo' })
export class BedTransferLog extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @ManyToOne(() => Bed)
  @JoinColumn({ name: 'from_bed_id' })
  fromBed!: Bed;

  @ManyToOne(() => Bed)
  @JoinColumn({ name: 'to_bed_id' })
  toBed!: Bed;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'authorised_by', type: 'uuid', nullable: true })
  authorisedBy!: string | null;
}

@Entity({ name: 'daily_progress_notes', schema: 'demo' })
export class DailyProgressNote extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @Column({ type: 'text' })
  subjective!: string;

  @Column({ type: 'text' })
  objective!: string;

  @Column({ type: 'text' })
  assessment!: string;

  @Column({ type: 'text' })
  plan!: string;
}

@Entity({ name: 'discharge_summaries', schema: 'demo' })
export class DischargeSummary extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission;

  @Column({ name: 'presenting_complaint', type: 'text' })
  presentingComplaint!: string;

  @Column({ type: 'text' })
  history!: string;

  @Column({ name: 'exam_on_admission', type: 'text' })
  examOnAdmission!: string;

  @Column({ name: 'investigations_summary', type: 'text' })
  investigationsSummary!: string;

  @Column({ name: 'final_diagnosis', type: 'text' })
  finalDiagnosis!: string;

  @Column({ name: 'treatment_given', type: 'text' })
  treatmentGiven!: string;

  @Column({ name: 'discharge_meds', type: 'text' })
  dischargeMeds!: string;

  @Column({ name: 'follow_up_instructions', type: 'text' })
  followUpInstructions!: string;

  @Column({ type: 'text', nullable: true })
  diet!: string | null;

  @Column({ type: 'varchar',  default: 'draft' })
  status!: 'draft' | 'complete';

  @Column({ name: 'finalised_by', type: 'uuid', nullable: true })
  finalisedBy!: string | null;

  @Column({ name: 'finalised_at', type: 'timestamptz', nullable: true })
  finalisedAt!: Date | null;
}
