import { BLOOD_BANK_METRIC_DEFINITIONS } from './blood-bank-policy';

export type BloodUnitScreening = 'awaiting_screening' | 'reactive' | 'released' | 'quarantine';
export type BloodUnitStatus =
  | 'received'
  | 'available'
  | 'reserved'
  | 'issued'
  | 'expired'
  | 'quarantined'
  | 'discarded';

export type BloodUnitRow = {
  unitNo: string;
  bloodGroup: string;
  status: BloodUnitStatus;
  screeningStatus: BloodUnitScreening;
  expiresAt: Date | string;
  issuedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  reservedRequestId?: string | null;
};

const NEAR_EXPIRY_DAYS = 7;

export function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isExpired(expiresAt: Date | string, now: Date) {
  const expiry = asDate(expiresAt);
  return !expiry || expiry.getTime() <= now.getTime();
}

export function isNearingExpiry(expiresAt: Date | string, now: Date) {
  const expiry = asDate(expiresAt);
  if (!expiry || expiry.getTime() <= now.getTime()) return false;
  return expiry.getTime() - now.getTime() <= NEAR_EXPIRY_DAYS * 86_400_000;
}

/** One primary bucket per unit so stock totals never double-count. */
export function primaryUnitBucket(
  unit: BloodUnitRow,
  now: Date,
):
  | 'discarded'
  | 'issued'
  | 'expired'
  | 'quarantined_or_awaiting'
  | 'reserved'
  | 'available'
  | 'held' {
  if (unit.status === 'discarded') return 'discarded';
  if (unit.status === 'issued') return 'issued';
  if (isExpired(unit.expiresAt, now) || unit.status === 'expired') return 'expired';
  if (
    unit.status === 'quarantined' ||
    unit.screeningStatus === 'quarantine' ||
    unit.screeningStatus === 'awaiting_screening' ||
    unit.screeningStatus === 'reactive'
  ) {
    return 'quarantined_or_awaiting';
  }
  if (unit.status === 'reserved' || unit.reservedRequestId) return 'reserved';
  if (unit.status === 'available' && unit.screeningStatus === 'released') return 'available';
  return 'held';
}

export function summariseBloodUnits(
  units: BloodUnitRow[],
  period: { start: Date; end: Date },
  now = new Date(),
) {
  const byGroup: Record<string, number> = {};
  const counts = {
    physicalOnHand: 0,
    availableForIssue: 0,
    reserved: 0,
    issuedInPeriod: 0,
    quarantinedOrAwaitingScreening: 0,
    expired: 0,
    nearingExpiry: 0,
  };

  let lastStockUpdate: Date | null = null;

  for (const unit of units) {
    const bucket = primaryUnitBucket(unit, now);
    const group = unit.bloodGroup?.trim() || 'unknown';
    if (bucket !== 'discarded' && bucket !== 'issued') {
      counts.physicalOnHand += 1;
      byGroup[group] = (byGroup[group] ?? 0) + 1;
    }
    if (bucket === 'available') counts.availableForIssue += 1;
    if (bucket === 'reserved') counts.reserved += 1;
    if (bucket === 'quarantined_or_awaiting') counts.quarantinedOrAwaitingScreening += 1;
    if (bucket === 'expired') counts.expired += 1;
    if (
      (bucket === 'available' || bucket === 'reserved') &&
      isNearingExpiry(unit.expiresAt, now)
    ) {
      counts.nearingExpiry += 1;
    }
    const issuedAt = asDate(unit.issuedAt ?? null);
    if (bucket === 'issued' && issuedAt && issuedAt >= period.start && issuedAt <= period.end) {
      counts.issuedInPeriod += 1;
    }
    const updated = asDate(unit.updatedAt ?? null);
    if (updated && (!lastStockUpdate || updated > lastStockUpdate)) lastStockUpdate = updated;
  }

  return {
    available: true as const,
    generatedAt: now.toISOString(),
    definitions: BLOOD_BANK_METRIC_DEFINITIONS,
    lastStockUpdate: lastStockUpdate?.toISOString() ?? null,
    ...counts,
    byGroup,
  };
}

export const UNIT_TRANSITIONS: Record<BloodUnitStatus, BloodUnitStatus[]> = {
  received: ['available', 'quarantined', 'expired', 'discarded'],
  available: ['reserved', 'quarantined', 'expired', 'discarded'],
  reserved: ['issued', 'available', 'quarantined', 'expired', 'discarded'],
  issued: [],
  expired: ['discarded'],
  quarantined: ['available', 'discarded', 'expired'],
  discarded: [],
};

export function assertUnitTransition(from: BloodUnitStatus, to: BloodUnitStatus) {
  if (from === to) {
    throw new Error('This unit is already in that status.');
  }
  if (!UNIT_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Cannot move a blood unit from ${from} to ${to}.`);
  }
}

export function assertUnitMayBecomeAvailable(screeningStatus: BloodUnitScreening, expiresAt: Date | string, now: Date) {
  if (screeningStatus !== 'released') {
    throw new Error('A unit cannot be available for issue until screening is recorded as released. Receipt is not a release.');
  }
  if (isExpired(expiresAt, now)) {
    throw new Error('An expired unit cannot be marked available.');
  }
}
