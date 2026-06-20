import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'radiology_modalities', schema: 'demo' })
export class RadiologyModality extends SoftDeleteClinicalEntity {
  @Column()
  name!: string;

  @Column({ unique: true })
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

  @Column({ name: 'request_no', unique: true })
  requestNo!: string;

  @Column({ name: 'body_part' })
  bodyPart!: string;

  @Column({ nullable: true })
  views!: string | null;

  @Column({ name: 'clinical_indication', type: 'text' })
  clinicalIndication!: string;

  @Column()
  priority!: 'routine' | 'urgent' | 'stat';

  @Column()
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
}

@Entity({ name: 'radiology_attachments', schema: 'demo' })
export class RadiologyAttachment extends SoftDeleteClinicalEntity {
  @ManyToOne(() => RadiologyRequest)
  @JoinColumn({ name: 'request_id' })
  request!: RadiologyRequest;

  @Column()
  filename!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ name: 'storage_path' })
  storagePath!: string;
}
