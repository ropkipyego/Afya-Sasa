import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteClinicalEntity } from '../common/auditable.entity';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import type { PaymentServiceLine } from './payment.entities';

export type ChargeStatus = 'owed' | 'partially_paid' | 'paid' | 'waived' | 'cancelled';

@Entity({ name: 'charges', schema: 'demo' })
@Index(['status', 'serviceLine'])
export class Charge extends SoftDeleteClinicalEntity {
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter!: Encounter | null;

  @Column({ type: 'varchar', name: 'service_line' })
  serviceLine!: PaymentServiceLine;

  @Column({ type: 'uuid', name: 'service_entity_id', nullable: true })
  serviceEntityId!: string | null;

  @Column({ type: 'varchar', name: 'service_description' })
  serviceDescription!: string;

  @Column({ type: 'numeric', name: 'amount_owed' })
  amountOwed!: string;

  @Column({ type: 'numeric', name: 'amount_paid', default: 0 })
  amountPaid!: string;

  @Column({ type: 'numeric', name: 'amount_waived', default: 0 })
  amountWaived!: string;

  @Column({ type: 'varchar', default: 'KES' })
  currency!: string;

  @Column({ type: 'varchar', default: 'owed' })
  status!: ChargeStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}

export function chargesEnabled(env = process.env): boolean {
  return env.AFYASASA_CHARGES_ENABLED === 'true';
}

export function chargeRemaining(charge: Pick<Charge, 'amountOwed' | 'amountPaid' | 'amountWaived'>): number {
  return Math.max(
    0,
    Number(charge.amountOwed) - Number(charge.amountPaid) - Number(charge.amountWaived),
  );
}
