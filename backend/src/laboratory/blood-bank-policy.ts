import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { BloodBankStatus } from './blood-bank.entities';

const REQUEST_TRANSITIONS: Record<BloodBankStatus, BloodBankStatus[]> = {
  requested: ['grouped', 'cancelled'],
  grouped: ['crossmatched', 'cancelled'],
  crossmatched: ['issued', 'cancelled'],
  issued: [],
  cancelled: [],
};

export function assertBloodBankRequestTransition(from: BloodBankStatus, to: BloodBankStatus) {
  if (from === to) {
    throw new BadRequestException('This blood bank request is already in that status.');
  }
  if (!REQUEST_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(
      `Cannot move a blood bank request from ${from} to ${to}. Record grouping and crossmatch in order, then authorised issue.`,
    );
  }
}

/** Issue is a clinical-governance gate: grouping and crossmatch must already be recorded. Compatibility is not inferred. */
export function assertBloodBankIssueReady(row: {
  groupingResult?: string | null;
  crossmatchResult?: string | null;
}) {
  if (!row.groupingResult?.trim() || !row.crossmatchResult?.trim()) {
    throw new BadRequestException(
      'Issue is blocked until grouping and crossmatch results are recorded. Compatibility is not calculated by the system.',
    );
  }
}

export function assertCanIssueBlood(permissions: string[] | undefined) {
  if (!permissions?.includes('lab_results:verify')) {
    throw new ForbiddenException(
      'Issuing blood requires laboratory result verification. Entering grouping or crossmatch is not sufficient.',
    );
  }
}

export const BLOOD_BANK_METRIC_DEFINITIONS = {
  physicalOnHand:
    'Units still held (not issued or discarded). Includes quarantined, awaiting screening, reserved and expired-on-shelf units.',
  availableForIssue:
    'Released, unexpired, unreserved units. Excludes quarantined, unscreened, reactive, reserved, issued, discarded and expired units.',
  reserved: 'Units reserved for a named request and not yet issued or expired.',
  issuedInPeriod: 'Units whose issue timestamp falls in the selected period. Each unit is counted once.',
  quarantinedOrAwaitingScreening:
    'Units awaiting screening, reactive, or explicitly quarantined. Receipt is not a release.',
  expired: 'Units whose expiry is on or before now and that have not been issued or discarded.',
  nearingExpiry: 'Available or reserved units expiring within seven days and not yet expired.',
} as const;
