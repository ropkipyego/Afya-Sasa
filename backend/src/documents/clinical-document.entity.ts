import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Patient } from '../patients/patient.entities';

export type ClinicalDocumentType =
  | 'consent'
  | 'referral_letter'
  | 'insurance'
  | 'lab_attachment'
  | 'radiology_pdf'
  | 'sick_sheet'
  | 'medical_certificate'
  | 'scanned_record'
  | 'discharge_summary'
  | 'operation_note'
  | 'other';

@Entity({ name: 'clinical_documents', schema: 'demo' })
@Index(['patient', 'documentType'])
export class ClinicalDocument extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ name: 'document_type', type: 'varchar' })
  documentType!: ClinicalDocumentType;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'varchar', name: 'storage_path' })
  storagePath!: string;

  @Column({ name: 'file_size', type: 'int', default: 0 })
  fileSize!: number;

  @Column({ type: 'varchar', nullable: true })
  checksum!: string | null;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId!: string | null;

  @Column({ name: 'admission_id', type: 'uuid', nullable: true })
  admissionId!: string | null;
}
