import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Entity({ name: 'lab_panels', schema: 'demo' })
export class LabPanel extends SoftDeleteClinicalEntity {
  @Column()
  name!: string;

  @Column({ unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column()
  category!: 'haematology' | 'biochemistry' | 'microbiology' | 'immunology' | 'urinalysis' | 'coagulation';
}

@Entity({ name: 'lab_tests', schema: 'demo' })
export class LabTest extends SoftDeleteClinicalEntity {
  @ManyToOne(() => LabPanel, { nullable: true })
  @JoinColumn({ name: 'panel_id' })
  panel!: LabPanel | null;

  @Column()
  name!: string;

  @Column({ unique: true })
  code!: string;

  @Column({ name: 'sample_type' })
  sampleType!: 'whole_blood' | 'serum' | 'plasma' | 'urine' | 'swab' | 'stool' | 'csf' | 'tissue';

  @Column({ name: 'turnaround_hours', nullable: true })
  turnaroundHours!: number | null;

  @Column({ name: 'reference_range', nullable: true })
  referenceRange!: string | null;

  @Column({ nullable: true })
  unit!: string | null;

  @Column({ name: 'critical_low', type: 'numeric', nullable: true })
  criticalLow!: string | null;

  @Column({ name: 'critical_high', type: 'numeric', nullable: true })
  criticalHigh!: string | null;
}

@Entity({ name: 'lab_requests', schema: 'demo' })
@Index(['status', 'priority'])
export class LabRequest extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @Column({ name: 'request_no', unique: true })
  requestNo!: string;

  @Column()
  priority!: 'routine' | 'urgent' | 'stat';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  status!: 'requested' | 'sample_collected' | 'processing' | 'resulted' | 'verified' | 'cancelled';

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason!: string | null;
}

@Entity({ name: 'lab_request_items', schema: 'demo' })
export class LabRequestItem extends SoftDeleteClinicalEntity {
  @ManyToOne(() => LabRequest)
  @JoinColumn({ name: 'request_id' })
  request!: LabRequest;

  @ManyToOne(() => LabTest, { nullable: true })
  @JoinColumn({ name: 'test_id' })
  test!: LabTest | null;

  @ManyToOne(() => LabPanel, { nullable: true })
  @JoinColumn({ name: 'panel_id' })
  panel!: LabPanel | null;

  @Column()
  status!: 'requested' | 'sample_collected' | 'processing' | 'resulted' | 'verified' | 'cancelled';
}

@Entity({ name: 'lab_samples', schema: 'demo' })
export class LabSample extends SoftDeleteClinicalEntity {
  @ManyToOne(() => LabRequest)
  @JoinColumn({ name: 'request_id' })
  request!: LabRequest;

  @Column({ unique: true })
  barcode!: string;

  @Column()
  type!: string;

  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true })
  collectedAt!: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Column({ nullable: true })
  condition!: 'adequate' | 'haemolysed' | 'clotted' | 'insufficient' | 'contaminated' | null;
}

@Entity({ name: 'lab_results', schema: 'demo' })
@Index(['isCritical', 'verifiedAt'])
export class LabResult extends SoftDeleteClinicalEntity {
  @ManyToOne(() => LabRequestItem)
  @JoinColumn({ name: 'request_item_id' })
  requestItem!: LabRequestItem;

  @ManyToOne(() => LabSample, { nullable: true })
  @JoinColumn({ name: 'sample_id' })
  sample!: LabSample | null;

  @Column({ type: 'text' })
  value!: string;

  @Column({ nullable: true })
  unit!: string | null;

  @Column()
  flag!: 'normal' | 'low' | 'high' | 'critically_low' | 'critically_high';

  @Column({ name: 'reference_range', nullable: true })
  referenceRange!: string | null;

  @Column({ name: 'is_critical', default: false })
  isCritical!: boolean;

  @Column({ name: 'entered_at', type: 'timestamptz', default: () => 'now()' })
  enteredAt!: Date;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;
}
