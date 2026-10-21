export const INSURANCE_CLAIM_STATUSES = [
  'draft',
  'eligibility_pending',
  'eligibility_verified',
  'eligibility_failed',
  'preauth_required',
  'preauth_pending',
  'preauth_approved',
  'preauth_rejected',
  'prepared',
  'submitted_manual',
  'acknowledged',
  'queried',
  'rejected',
  'approved',
  'partially_approved',
  'partially_paid',
  'settled',
  'cancelled',
] as const;

export type InsuranceClaimStatus = (typeof INSURANCE_CLAIM_STATUSES)[number];

export type InsurancePayerType =
  | 'sha'
  | 'private_insurer'
  | 'tpa'
  | 'corporate'
  | 'staff'
  | 'self_pay'
  | 'waiver';

const TRANSITIONS: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
  draft: ['eligibility_pending', 'prepared', 'cancelled'],
  eligibility_pending: ['eligibility_verified', 'eligibility_failed', 'cancelled'],
  eligibility_verified: ['preauth_required', 'prepared', 'cancelled'],
  eligibility_failed: ['eligibility_pending', 'cancelled'],
  preauth_required: ['preauth_pending', 'cancelled'],
  preauth_pending: ['preauth_approved', 'preauth_rejected', 'cancelled'],
  preauth_approved: ['prepared', 'cancelled'],
  preauth_rejected: ['preauth_required', 'cancelled'],
  prepared: ['submitted_manual', 'cancelled'],
  submitted_manual: ['acknowledged', 'queried', 'rejected', 'cancelled'],
  acknowledged: ['queried', 'rejected', 'approved', 'partially_approved', 'cancelled'],
  queried: ['prepared', 'rejected', 'cancelled'],
  rejected: ['prepared', 'cancelled'],
  approved: ['partially_paid', 'settled', 'cancelled'],
  partially_approved: ['partially_paid', 'queried', 'cancelled'],
  partially_paid: ['settled', 'queried'],
  settled: [],
  cancelled: [],
};

export function allowedClaimTransitions(from: InsuranceClaimStatus): InsuranceClaimStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransitionClaim(from: InsuranceClaimStatus, to: InsuranceClaimStatus) {
  return allowedClaimTransitions(from).includes(to);
}

export function assertClaimTransition(from: InsuranceClaimStatus, to: InsuranceClaimStatus) {
  if (!canTransitionClaim(from, to)) {
    throw new Error(`Claim cannot move from ${from} to ${to}`);
  }
}

export function claimIsCashEquivalent(status: InsuranceClaimStatus) {
  return status === 'partially_paid' || status === 'settled';
}

/** Remittance recording is cash-adjacent. Cashier/finance manage only — not claims-officer drafts. */
export function claimIsRemittanceStatus(status: InsuranceClaimStatus) {
  return status === 'partially_paid' || status === 'settled';
}

const MATERIAL_STATUSES = new Set<InsuranceClaimStatus>([
  'submitted_manual',
  'queried',
  'rejected',
  'cancelled',
  'preauth_rejected',
  'eligibility_failed',
  'partially_paid',
  'settled',
]);

export function claimTransitionRequiresReason(to: InsuranceClaimStatus) {
  return MATERIAL_STATUSES.has(to);
}

export function eligibilityVerificationKind(source: string) {
  if (source === 'live') return 'verified_insurer_response' as const;
  if (source === 'stub') return 'practice_mode_not_live' as const;
  return 'recorded_without_insurer_response' as const;
}

export function splitResponsibility(input: {
  totalCharge: number;
  approvedAmount?: number | null;
  patientShare?: number | null;
  amountReceived: number;
}) {
  const totalCharge = Math.max(0, input.totalCharge);
  const approved =
    input.approvedAmount == null || !Number.isFinite(input.approvedAmount)
      ? null
      : Math.max(0, input.approvedAmount);
  const patientShare =
    input.patientShare == null || !Number.isFinite(input.patientShare)
      ? null
      : Math.max(0, input.patientShare);
  const received = Math.max(0, input.amountReceived);
  const estimatedInsurer = approved ?? Math.max(0, totalCharge - (patientShare ?? 0));
  return {
    totalCharge,
    insurerShareEstimate: estimatedInsurer,
    approvedAmount: approved,
    patientShare,
    amountReceived: received,
    remainingPatientBalance: Math.max(0, (patientShare ?? totalCharge) - received),
    remainingInsurerReceivable: approved == null ? null : Math.max(0, approved - Math.max(0, received - (patientShare ?? 0))),
    guaranteedReceivable: approved != null,
  };
}

export const DEFAULT_PAYERS: Array<{
  id: string;
  type: InsurancePayerType;
  name: string;
  active: boolean;
  notes: string;
}> = [
  {
    id: 'payer-sha',
    type: 'sha',
    name: 'Social Health Authority',
    active: true,
    notes: 'Eligibility via SHA HIE when credentials exist. Claims remain on portal.sha.go.ke until an approved claims pack is connected.',
  },
  {
    id: 'payer-self',
    type: 'self_pay',
    name: 'Self-pay',
    active: true,
    notes: 'Patient settles through the cashier. Not an insurer receivable.',
  },
];
