import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { User } from '../core/core.entities';
import { Encounter } from '../opd/opd.entities';

export type EmergencyTriageCategory = 'red' | 'orange' | 'yellow' | 'green' | 'black';
export type EmergencyWorkflowStage =
  | 'arrival'
  | 'triaged'
  | 'treatment'
  | 'doctor_assessment'
  | 'investigations'
  | 'observation'
  | 'disposition_pending'
  | 'disposed';
export type EmergencyOutcome =
  | 'discharged_home'
  | 'admitted_ipd'
  | 'transferred_icu'
  | 'transferred_hdu'
  | 'transferred_theatre'
  | 'transferred_maternity'
  | 'external_referral'
  | 'deceased'
  | 'left_without_being_seen';

@Entity({ name: 'emergency_treatment_bays', schema: 'demo' })
export class EmergencyTreatmentBay extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar', name: 'bay_type', default: 'treatment' })
  bayType!: 'treatment' | 'resuscitation' | 'observation';

  @Column({ type: 'varchar', default: 'available' })
  status!: 'available' | 'occupied' | 'cleaning' | 'closed';

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;
}

@Entity({ name: 'emergency_encounters', schema: 'demo' })
@Index(['status'])
@Index(['triageCategory'])
export class EmergencyEncounter extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ type: 'varchar', name: 'arrival_mode' })
  arrivalMode!: 'ambulance' | 'walk_in' | 'police' | 'referral' | 'airlift';

  @Column({ name: 'arrival_time', type: 'timestamptz', default: () => 'now()' })
  arrivalTime!: Date;

  @Column({ type: 'boolean', name: 'trauma_flag', default: false })
  traumaFlag!: boolean;

  @Column({ name: 'trauma_mechanism', type: 'text', nullable: true })
  traumaMechanism!: string | null;

  @Column({ type: 'varchar' })
  status!: 'active' | 'disposed';

  @Column({ type: 'varchar', name: 'workflow_stage', default: 'arrival' })
  workflowStage!: EmergencyWorkflowStage;

  @Column({ type: 'varchar', name: 'triage_category', nullable: true })
  triageCategory!: EmergencyTriageCategory | null;

  @Column({ type: 'varchar', nullable: true })
  disposition!: string | null;

  @Column({ type: 'varchar', nullable: true })
  outcome!: EmergencyOutcome | null;

  @Column({ type: 'varchar', name: 'transfer_facility', nullable: true })
  transferFacility!: string | null;

  @Column({ name: 'disposition_notes', type: 'text', nullable: true })
  dispositionNotes!: string | null;

  @Column({ type: 'boolean', name: 'resuscitation_flag', default: false })
  resuscitationFlag!: boolean;

  @Column({ name: 'resuscitation_notes', type: 'text', nullable: true })
  resuscitationNotes!: string | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_clinician_id' })
  assignedClinician!: User | null;

  @ManyToOne(() => EmergencyTreatmentBay, { nullable: true })
  @JoinColumn({ name: 'bay_id' })
  bay!: EmergencyTreatmentBay | null;

  @Column({ name: 'observation_started_at', type: 'timestamptz', nullable: true })
  observationStartedAt!: Date | null;
}

@Entity({ name: 'emergency_notes', schema: 'demo' })
export class EmergencyNote extends SoftDeleteClinicalEntity {
  @ManyToOne(() => EmergencyEncounter)
  @JoinColumn({ name: 'emergency_id' })
  emergency!: EmergencyEncounter;

  @Column({ type: 'varchar', name: 'note_type', default: 'clinical' })
  noteType!: 'clinical' | 'nursing' | 'doctor' | 'handover';

  @Column({ type: 'text' })
  body!: string;
}

@Entity({ name: 'emergency_observation_logs', schema: 'demo' })
export class EmergencyObservationLog extends SoftDeleteClinicalEntity {
  @ManyToOne(() => EmergencyEncounter)
  @JoinColumn({ name: 'emergency_id' })
  emergency!: EmergencyEncounter;

  @Column({ name: 'vitals_summary', type: 'text', nullable: true })
  vitalsSummary!: string | null;

  @Column({ name: 'nursing_notes', type: 'text', nullable: true })
  nursingNotes!: string | null;

  @Column({ name: 'doctor_review', type: 'text', nullable: true })
  doctorReview!: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;
}

@Entity({ name: 'critical_alerts', schema: 'demo' })
@Index(['severity', 'acknowledgedAt'])
export class CriticalAlert extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @Column({ type: 'varchar' })
  type!: 'critical_vitals' | 'allergy' | 'critical_lab' | 'drug_interaction' | 'code_blue';

  @Column({ type: 'varchar' })
  severity!: 'warning' | 'critical';

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy!: string | null;

  @Column({ type: 'boolean', name: 'is_auto', default: false })
  isAuto!: boolean;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy!: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;
}
