import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../common/auditable.entity';

export type ShaCheckOutcome =
  | 'eligible'
  | 'ineligible'
  | 'not_found'
  | 'input_error'
  | 'disconnected'
  | 'error';

export type ShaCheckSource = 'live' | 'stub' | 'disconnected';

export type ShaScheme = {
  schemeName?: string;
  status?: string;
  fund?: string;
  validFrom?: string;
  validTo?: string;
};

@Entity({ name: 'sha_eligibility_checks', schema: 'demo' })
@Index(['patientId', 'createdAt'])
export class ShaEligibilityCheck extends AuditableEntity {
  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @Column({ name: 'identification_type', type: 'varchar' })
  identificationType!: string;

  @Column({ name: 'identification_number', type: 'varchar' })
  identificationNumber!: string;

  @Column({ type: 'varchar' })
  outcome!: ShaCheckOutcome;

  @Column({ type: 'varchar' })
  source!: ShaCheckSource;

  @Column({ name: 'member_cr_number', type: 'varchar', nullable: true })
  memberCrNumber!: string | null;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName!: string | null;

  @Column({ name: 'date_of_birth', type: 'varchar', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender!: string | null;

  @Column({ type: 'int', nullable: true })
  age!: number | null;

  @Column({ name: 'is_alive', type: 'boolean', nullable: true })
  isAlive!: boolean | null;

  @Column({ name: 'whitelisted_for_otp', type: 'boolean', nullable: true })
  whitelistedForOtp!: boolean | null;

  @Column({ name: 'facility_biometrics_enforced', type: 'boolean', nullable: true })
  facilityBiometricsEnforced!: boolean | null;

  @Column({ name: 'status_code', type: 'varchar', nullable: true })
  statusCode!: string | null;

  @Column({ name: 'status_desc', type: 'text', nullable: true })
  statusDesc!: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  schemes!: ShaScheme[];

  @Column({ name: 'pomsf_eligible', type: 'boolean', default: false })
  pomsfEligible!: boolean;
}
