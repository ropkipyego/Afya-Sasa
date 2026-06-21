import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'radiology_modalities', schema: 'demo' })
export class RadiologyModality extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar',  unique: true })
  code!: string;
}

@Entity({ name: 'radiology_requests', schema: 'demo' })
@Index(['status', 'priority'])
export class RadiologyRequest extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @ManyToOne(() => RadiologyModality)
  @JoinColumn({ name: 'modality_id' })
  modality!: RadiologyModality;

  @Column({ type: 'varchar',  name: 'request_no', unique: true })
  requestNo!: string;

  @Column({ type: 'varchar',  name: 'body_part' })
  bodyPart!: string;

  @Column({ type: 'varchar',  nullable: true })
  views!: string | null;

  @Column({ name: 'clinical_indication', type: 'text' })
  clinicalIndication!: string;

  @Column({ type: 'varchar' })
  priority!: 'routine' | 'urgent' | 'stat';

  @Column({ type: 'varchar' })
  status!: 'requested' | 'scheduled' | 'in_progress' | 'reported' | 'verified' | 'cancelled';
}

@Entity({ name: 'radiology_reports', schema: 'demo' })
export class RadiologyReport extends SoftDeleteClinicalEntity {
  @ManyToOne(() => RadiologyRequest)
  @JoinColumn({ name: 'request_id' })
  request!: RadiologyRequest;

  @Column({ type: 'text' })
  findings!: string;

  @Column({ type: 'text' })
  impression!: string;

  @Column({ type: 'text', nullable: true })
  recommendation!: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;
}

@Entity({ name: 'radiology_attachments', schema: 'demo' })
export class RadiologyAttachment extends SoftDeleteClinicalEntity {
  @ManyToOne(() => RadiologyRequest)
  @JoinColumn({ name: 'request_id' })
  request!: RadiologyRequest;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar',  name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'varchar',  name: 'storage_path' })
  storagePath!: string;
}
