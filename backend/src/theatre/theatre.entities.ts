import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'theatres', schema: 'demo' })
@Unique(['code'])
export class Theatre extends SoftDeleteClinicalEntity {
  @Column()
  name!: string;

  @Column()
  code!: string;

  @Column({ nullable: true })
  location!: string | null;

  @Column()
  status!: 'available' | 'in_use' | 'maintenance' | 'closed';
}

@Entity({ name: 'surgical_procedures', schema: 'demo' })
@Unique(['code'])
export class SurgicalProcedure extends SoftDeleteClinicalEntity {
  @Column()
  name!: string;

  @Column()
  code!: string;

  @Column({ nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'expected_duration_minutes', nullable: true })
  expectedDurationMinutes!: number | null;

  @Column({ default: true })
  active!: boolean;
}

@Entity({ name: 'surgery_bookings', schema: 'demo' })
@Index(['status', 'scheduledStartAt'])
export class SurgeryBooking extends SoftDeleteClinicalEntity {
  @Column({ name: 'booking_no', unique: true })
  bookingNo!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @ManyToOne(() => SurgicalProcedure)
  @JoinColumn({ name: 'procedure_id' })
  procedure!: SurgicalProcedure;

  @ManyToOne(() => Theatre, { nullable: true })
  @JoinColumn({ name: 'theatre_id' })
  theatre!: Theatre | null;

  @Column({ name: 'scheduled_start_at', type: 'timestamptz' })
  scheduledStartAt!: Date;

  @Column({ name: 'scheduled_end_at', type: 'timestamptz', nullable: true })
  scheduledEndAt!: Date | null;

  @Column({ name: 'actual_start_at', type: 'timestamptz', nullable: true })
  actualStartAt!: Date | null;

  @Column({ name: 'actual_end_at', type: 'timestamptz', nullable: true })
  actualEndAt!: Date | null;

  @Column()
  priority!: 'elective' | 'urgent' | 'emergency';

  @Column()
  status!: 'requested' | 'scheduled' | 'pre_op' | 'in_theatre' | 'recovery' | 'completed' | 'cancelled';

  @Column({ name: 'consent_status', default: 'pending' })
  consentStatus!: 'not_required' | 'pending' | 'signed' | 'withdrawn';

  @Column({ name: 'checklist_status', default: 'pending' })
  checklistStatus!: 'pending' | 'complete';
}

@Entity({ name: 'surgery_staff', schema: 'demo' })
@Unique(['booking', 'user', 'role'])
export class SurgeryStaff extends SoftDeleteClinicalEntity {
  @ManyToOne(() => SurgeryBooking)
  @JoinColumn({ name: 'surgery_booking_id' })
  booking!: SurgeryBooking;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  role!: 'primary_surgeon' | 'assistant_surgeon' | 'anesthetist' | 'theatre_nurse' | 'scrub_nurse' | 'circulating_nurse';

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'now()' })
  assignedAt!: Date;
}

@Entity({ name: 'surgery_notes', schema: 'demo' })
export class SurgeryNote extends SoftDeleteClinicalEntity {
  @ManyToOne(() => SurgeryBooking)
  @JoinColumn({ name: 'surgery_booking_id' })
  booking!: SurgeryBooking;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'author_id' })
  author!: User | null;

  @ManyToOne(() => SurgeryNote, { nullable: true })
  @JoinColumn({ name: 'amends_note_id' })
  amendsNote!: SurgeryNote | null;

  @Column()
  type!: 'pre_op_assessment' | 'consent' | 'checklist' | 'intraoperative' | 'operation' | 'findings' | 'post_op' | 'recovery';

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'amendment_reason', type: 'text', nullable: true })
  amendmentReason!: string | null;
}

@Entity({ name: 'surgery_complications', schema: 'demo' })
export class SurgeryComplication extends SoftDeleteClinicalEntity {
  @ManyToOne(() => SurgeryBooking)
  @JoinColumn({ name: 'surgery_booking_id' })
  booking!: SurgeryBooking;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reported_by' })
  reportedBy!: User | null;

  @Column()
  severity!: 'minor' | 'moderate' | 'severe' | 'sentinel';

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'action_taken', type: 'text' })
  actionTaken!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;
}
