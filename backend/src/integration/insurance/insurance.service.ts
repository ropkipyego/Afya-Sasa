import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { RequestContext } from '../../common/request-context';
import { TenantSettings } from '../../core/core.entities';
import { Charge, chargeRemaining } from '../../payments/charge.entities';
import { Patient } from '../../patients/patient.entities';
import { ShaEligibilityCheck } from '../sha/sha.entities';
import {
  allowedClaimTransitions,
  assertClaimTransition,
  claimIsRemittanceStatus,
  claimTransitionRequiresReason,
  DEFAULT_PAYERS,
  eligibilityVerificationKind,
  INSURANCE_CLAIM_STATUSES,
  splitResponsibility,
  type InsuranceClaimStatus,
  type InsurancePayerType,
} from './insurance-lifecycle';

type PayerRecord = {
  id: string;
  type: InsurancePayerType;
  name: string;
  active: boolean;
  notes: string;
};

type ClaimRecord = {
  id: string;
  patientId: string;
  payerId: string;
  status: InsuranceClaimStatus;
  chargeIds: string[];
  totalCharge: number;
  approvedAmount: number | null;
  patientShare: number | null;
  amountReceived: number;
  externalReference: string | null;
  history: Array<{
    at: string;
    from: InsuranceClaimStatus | null;
    to: InsuranceClaimStatus;
    actor: string | null;
    reason: string | null;
  }>;
};

type WorkspaceState = {
  payers: PayerRecord[];
  claims: ClaimRecord[];
};

@Injectable()
export class InsuranceService {
  constructor(
    @InjectRepository(TenantSettings) private readonly settings: Repository<TenantSettings>,
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(ShaEligibilityCheck)
    private readonly eligibility: Repository<ShaEligibilityCheck>,
  ) {}

  async workspace(request: RequestContext) {
    const state = await this.load(request);
    const eligibility = await this.eligibility.find({
      order: { createdAt: 'DESC' },
      take: 40,
    });
    return {
      payers: state.payers,
      claims: state.claims.map((claim) => ({
        ...claim,
        split: splitResponsibility(claim),
        cashEquivalent: claimIsRemittanceStatus(claim.status),
        allowedTransitions: allowedClaimTransitions(claim.status),
      })),
      eligibility: eligibility.map((row) => ({
        id: row.id,
        patientId: row.patientId,
        outcome: row.outcome,
        source: row.source,
        verificationKind: eligibilityVerificationKind(row.source),
        createdAt: row.createdAt,
        identificationType: row.identificationType,
      })),
      claimStatuses: INSURANCE_CLAIM_STATUSES,
      notes: [
        'A drafted or approved claim is not a payment.',
        'submitted_manual means staff recorded a portal claim number. AfyaSasa does not post to SHA from this workspace.',
        'Settled / partially_paid records remittance status only. They do not create cashier payment_transactions.',
        'Live SHA checks are verified insurer responses. Stub and disconnected rows are not live eligibility.',
        'Unapproved insurer estimates are not guaranteed receivables.',
      ],
    };
  }

  async savePayer(
    body: { id?: string; type: InsurancePayerType; name: string; active?: boolean; notes?: string },
    request: RequestContext,
  ) {
    const state = await this.load(request);
    const id = body.id?.trim() || `payer-${randomUUID()}`;
    const existing = state.payers.find((row) => row.id === id);
    const next: PayerRecord = {
      id,
      type: body.type,
      name: body.name.trim(),
      active: body.active ?? true,
      notes: body.notes?.trim() || existing?.notes || '',
    };
    if (!next.name) throw new BadRequestException('Payer name is required');
    state.payers = [...state.payers.filter((row) => row.id !== id), next];
    await this.persist(state, request);
    return next;
  }

  async prepareClaim(
    body: { patientId: string; payerId: string; chargeIds: string[] },
    request: RequestContext,
  ) {
    const state = await this.load(request);
    const patient = await this.patients.findOne({ where: { id: body.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const payer = state.payers.find((row) => row.id === body.payerId && row.active);
    if (!payer) throw new BadRequestException('Select an active payer');
    const chargeIds = [...new Set(body.chargeIds ?? [])];
    if (!chargeIds.length) throw new BadRequestException('Select at least one charge');
    const used = new Set(state.claims.flatMap((claim) => claim.chargeIds));
    const duplicate = chargeIds.find((id) => used.has(id));
    if (duplicate) throw new BadRequestException('A selected charge is already on another claim draft');
    const charges = await this.charges.find({
      where: { id: In(chargeIds) },
      relations: { patient: true },
    });
    if (charges.length !== chargeIds.length) throw new BadRequestException('One or more charges were not found');
    if (charges.some((charge) => charge.patient?.id !== body.patientId)) {
      throw new BadRequestException('Charges must belong to the selected patient');
    }
    if (charges.some((charge) => charge.status === 'cancelled')) {
      throw new BadRequestException('Cancelled charges cannot be added to a claim');
    }
    const totalCharge = charges.reduce((sum, charge) => sum + Number(charge.amountOwed), 0);
    const amountReceived = charges.reduce((sum, charge) => sum + Number(charge.amountPaid), 0);
    const now = new Date().toISOString();
    const claim: ClaimRecord = {
      id: `claim-${randomUUID()}`,
      patientId: body.patientId,
      payerId: payer.id,
      status: 'draft',
      chargeIds,
      totalCharge,
      approvedAmount: null,
      patientShare: charges.reduce((sum, charge) => sum + chargeRemaining(charge), 0),
      amountReceived,
      externalReference: null,
      history: [
        {
          at: now,
          from: null,
          to: 'draft',
          actor: request.user?.sub ?? null,
          reason: 'Prepared from existing charges',
        },
      ],
    };
    state.claims.push(claim);
    await this.persist(state, request);
    return claim;
  }

  async transitionClaim(
    id: string,
    body: {
      status: InsuranceClaimStatus;
      externalReference?: string;
      approvedAmount?: number | null;
      reason?: string;
    },
    request: RequestContext,
  ) {
    const state = await this.load(request);
    const claim = state.claims.find((row) => row.id === id);
    if (!claim) throw new NotFoundException('Claim not found');
    try {
      assertClaimTransition(claim.status, body.status);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const permissions = request.user?.permissions ?? [];
    if (claimIsRemittanceStatus(body.status) && !permissions.includes('payments:manage')) {
      throw new ForbiddenException(
        'Recording remittance (partially_paid or settled) needs payments:manage. This does not post a cashier payment.',
      );
    }
    if (body.status === 'submitted_manual' && !body.externalReference?.trim()) {
      throw new BadRequestException('Record the SHA/portal claim number before marking submitted_manual');
    }
    const reason = body.reason?.trim() || null;
    if (claimTransitionRequiresReason(body.status) && !reason) {
      throw new BadRequestException('Record a reason for this claim status change');
    }
    const from = claim.status;
    claim.status = body.status;
    if (body.externalReference?.trim()) claim.externalReference = body.externalReference.trim();
    if (body.approvedAmount != null) claim.approvedAmount = Number(body.approvedAmount);
    claim.history.push({
      at: new Date().toISOString(),
      from,
      to: body.status,
      actor: request.user?.sub ?? null,
      reason,
    });
    await this.persist(state, request);
    return { ...claim, split: splitResponsibility(claim), cashEquivalent: claimIsRemittanceStatus(claim.status) };
  }

  private async loadSettings(request: RequestContext) {
    if (request.tenant?.id) {
      return this.settings.findOne({ where: { tenant: { id: request.tenant.id } } });
    }
    const [row] = await this.settings.find({ take: 1 });
    return row ?? null;
  }

  private async load(request: RequestContext): Promise<WorkspaceState> {
    const settings = await this.loadSettings(request);
    const catalog = (settings?.clinicalCatalog ?? {}) as Record<string, unknown>;
    const raw = catalog.insuranceWorkspace as WorkspaceState | undefined;
    return {
      payers: Array.isArray(raw?.payers) && raw.payers.length ? raw.payers : [...DEFAULT_PAYERS],
      claims: Array.isArray(raw?.claims) ? raw.claims : [],
    };
  }

  private async persist(state: WorkspaceState, request: RequestContext) {
    const settings = await this.loadSettings(request);
    if (!settings) throw new BadRequestException('Hospital settings are not available');
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    catalog.insuranceWorkspace = state;
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
  }
}
