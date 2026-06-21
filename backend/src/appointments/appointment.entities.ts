import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Patient } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';

@Entity({ name: 'appointment_slots', schema: 'demo' })
@Index(['doctorId', 'date'])
export class AppointmentSlot extends SoftDeleteClinicalEntity {
  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: User | null;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar',  name: 'start_time' })
  startTime!: string;

  @Column({ type: 'varchar',  name: 'end_time' })
  endTime!: string;

  @Column({ type: 'int',  name: 'max_patients', default: 1 })
  maxPatients!: number;

  @Column({ type: 'boolean',  default: true })
  available!: boolean;
}

@Entity({ name: 'appointments', schema: 'demo' })
@Index(['appointmentDate', 'status'])
export class Appointment extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: User | null;

  @ManyToOne(() => AppointmentSlot, { nullable: true })
  @JoinColumn({ name: 'slot_id' })
  slot!: AppointmentSlot | null;

  @Column({ name: 'appointment_date', type: 'date' })
  appointmentDate!: string;

  @Column({ type: 'varchar',  name: 'appointment_time' })
  appointmentTime!: string;

  @Column({ type: 'varchar' })
  type!: 'new' | 'follow_up' | 'procedure' | 'review' | 'antenatal';

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar' })
  status!: 'scheduled' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'source_encounter_id' })
  sourceEncounter!: Encounter | null;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'linked_encounter_id' })
  linkedEncounter!: Encounter | null;
}
