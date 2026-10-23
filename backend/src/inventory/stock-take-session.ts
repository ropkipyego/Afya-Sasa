import { domainBadRequest, domainForbidden } from '../common/errors/domain-exception';
import { ERROR_CODES } from '../common/errors/error-codes';
import { roundQty, stockVariance } from './stock-integrity';

export type StockTakeSessionStatus = 'open' | 'submitted' | 'rejected' | 'posted';

export function varianceNeedsReason(expectedQty: number, countedQty: number) {
  return stockVariance(countedQty, expectedQty) !== 0;
}

export function assertVarianceReason(expectedQty: number, countedQty: number, reason?: string | null) {
  if (!varianceNeedsReason(expectedQty, countedQty)) return;
  if (!reason?.trim() || reason.trim().length < 3) {
    throw domainBadRequest(
      ERROR_CODES.STOCK_TAKE_INVALID,
      'A reason is required when counted quantity differs from the expected baseline.',
      { nextAction: 'Enter a short explanation for the shortage or surplus, then save the count again.' },
    );
  }
}

export function assertCanCount(status: StockTakeSessionStatus) {
  if (status === 'open' || status === 'rejected') return;
  throw domainBadRequest(
    ERROR_CODES.STOCK_TAKE_INVALID,
    `Counts cannot be changed while the session is ${status}.`,
    { nextAction: status === 'submitted' ? 'Reject the session for recount, or wait for independent approval.' : 'This session is already posted.' },
  );
}

export function assertCanSubmit(status: StockTakeSessionStatus) {
  if (status === 'open' || status === 'rejected') return;
  throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, `Session cannot be submitted from ${status}.`);
}

export function assertCanReject(status: StockTakeSessionStatus) {
  if (status === 'submitted') return;
  throw domainBadRequest(ERROR_CODES.STOCK_TAKE_INVALID, `Only a submitted session can be rejected. Current status is ${status}.`);
}

export function assertIndependentApprover(submittedBy: string | null | undefined, actorId: string | null | undefined) {
  if (!actorId) {
    throw domainForbidden(ERROR_CODES.STOCK_TAKE_INDEPENDENT_APPROVAL, 'Sign in before approving a stock take.');
  }
  if (submittedBy && submittedBy === actorId) {
    throw domainForbidden(
      ERROR_CODES.STOCK_TAKE_INDEPENDENT_APPROVAL,
      'The person who submitted this count cannot approve it.',
      { nextAction: 'Ask another inventory:manage user to review and post the variances.' },
    );
  }
}

export function countedOrNull(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return roundQty(value);
}
