import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Patient } from '../patients/patient.entities';
import { User } from '../core/core.entities';

export const BIOMETRIC_PROVIDER_DIGITALPERSONA = 'digitalpersona_4500';

@Entity({ name: 'biometric_devices', schema: 'demo' })
@Index(['deviceKey'], { unique: true })
export class BiometricDevice extends SoftDeleteClinicalEntity {
  @Column({ type: 'varchar', name: 'device_key' })
  deviceKey!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  provider!: string;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'online' | 'offline' | 'disabled';

  @Column({ name: 'secret_hash', type: 'varchar' })
  secretHash!: string;

  @Column({ name: 'agent_version', type: 'varchar', nullable: true })
  agentVersion!: string | null;

  @Column({ name: 'last_heartbeat_at', type: 'timestamptz', nullable: true })
  lastHeartbeatAt!: Date | null;

  @Column({ name: 'last_success_at', type: 'timestamptz', nullable: true })
  lastSuccessAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}

@Entity({ name: 'biometric_identities', schema: 'demo' })
@Index(['externalSubjectId', 'provider'], { unique: true })
export class BiometricIdentity extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @Column({ type: 'varchar' })
  provider!: string;

  @Column({ type: 'varchar', name: 'device_id', nullable: true })
  deviceId!: string | null;

  @Column({ type: 'varchar', name: 'external_subject_id' })
  externalSubjectId!: string;

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'unlinked';

  @Column({ type: 'varchar', name: 'finger_position', nullable: true })
  fingerPosition!: string | null;

  @Column({ name: 'template_cipher', type: 'text', nullable: true, select: false })
  templateCipher!: string | null;
}

@Entity({ name: 'biometric_verifications', schema: 'demo' })
@Index(['patient', 'createdAt'])
export class BiometricVerification extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient | null;

  @ManyToOne(() => BiometricIdentity, { nullable: true })
  @JoinColumn({ name: 'biometric_identity_id' })
  biometricIdentity!: BiometricIdentity | null;

  @Column({ type: 'varchar', name: 'device_id', nullable: true })
  deviceId!: string | null;

  @Column({ type: 'varchar' })
  provider!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'operator_user_id' })
  operator!: User | null;

  @Column({ type: 'varchar' })
  purpose!: 'enroll' | 'verify' | 'identify' | 'unlink' | 'device_test';

  @Column({ type: 'varchar' })
  result!:
    | 'verified'
    | 'not_verified'
    | 'no_match'
    | 'multiple_candidates'
    | 'device_error'
    | 'timeout'
    | 'cancelled'
    | 'enrolled'
    | 'unlinked';

  @Column({ type: 'numeric', nullable: true })
  confidence!: string | null;

  @Column({ type: 'varchar', name: 'external_reference', nullable: true })
  externalReference!: string | null;

  @Column({ type: 'varchar', name: 'correlation_id', nullable: true })
  correlationId!: string | null;
}
