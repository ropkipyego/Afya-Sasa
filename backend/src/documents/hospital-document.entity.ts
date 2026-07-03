import { Column, Entity } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';

@Entity({ name: 'hospital_documents', schema: 'demo' })
export class HospitalDocument extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', default: 'general' })
  category!: string;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'varchar', name: 'storage_path' })
  storagePath!: string;

  @Column({ type: 'int', name: 'file_size', default: 0 })
  fileSize!: number;

  @Column({ type: 'boolean', name: 'is_published', default: true })
  isPublished!: boolean;

  /** all | clinical | admin | lab | radiology | nursing | reception */
  @Column({ type: 'varchar', default: 'all' })
  audience!: string;
}
