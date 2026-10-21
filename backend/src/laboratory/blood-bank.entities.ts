import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

export type BloodBankProduct =
  | 'packed_red_cells'
  | 'whole_blood'
  | 'ffp'
  | 'platelets'
  | 'cryoprecipitate';

export type BloodBankStatus = 'requested' | 'grouped' | 'crossmatched' | 'issued' | 'cancelled';

@Entity({ name: 'blood_bank_requests', schema: 'demo' })
export class BloodBankRequest extends SoftDeleteClinicalEntity {
  @Column({ name: 'request_no', type: 'varchar', unique: true })
  requestNo!: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission!: Admission | null;

  @Column({ type: 'varchar' })
  product!: BloodBankProduct;

  @Column({ type: 'numeric' })
  units!: string;

  @Column({ name: 'patient_blood_group', type: 'varchar', nullable: true })
  patientBloodGroup!: string | null;

  @Column({ type: 'text', nullable: true })
  indication!: string | null;

  @Column({ type: 'varchar', default: 'requested' })
  status!: BloodBankStatus;

  @Column({ name: 'grouping_result', type: 'varchar', nullable: true })
  groupingResult!: string | null;

  @Column({ name: 'crossmatch_result', type: 'varchar', nullable: true })
  crossmatchResult!: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt!: Date | null;
}
