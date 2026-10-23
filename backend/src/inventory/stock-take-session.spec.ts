import { ERROR_CODES } from '../common/errors/error-codes';
import {
  assertCanCount,
  assertCanReject,
  assertCanSubmit,
  assertIndependentApprover,
  assertVarianceReason,
  varianceNeedsReason,
} from './stock-take-session';

describe('stock-take session rules', () => {
  it('requires a reason only when counted differs from expected', () => {
    expect(varianceNeedsReason(10, 10)).toBe(false);
    expect(varianceNeedsReason(10, 8)).toBe(true);
    expect(() => assertVarianceReason(10, 10, '')).not.toThrow();
    expect(() => assertVarianceReason(10, 8, '')).toThrow(/reason is required/);
    expect(() => assertVarianceReason(10, 12, 'surplus found in cupboard')).not.toThrow();
  });

  it('allows counting while open or rejected, not after submit or post', () => {
    expect(() => assertCanCount('open')).not.toThrow();
    expect(() => assertCanCount('rejected')).not.toThrow();
    expect(() => assertCanCount('submitted')).toThrow(/cannot be changed/);
    expect(() => assertCanCount('posted')).toThrow(/cannot be changed while the session is posted/);
  });

  it('submits from open or rejected and rejects only submitted sessions', () => {
    expect(() => assertCanSubmit('open')).not.toThrow();
    expect(() => assertCanSubmit('rejected')).not.toThrow();
    expect(() => assertCanSubmit('posted')).toThrow(/cannot be submitted/);
    expect(() => assertCanReject('submitted')).not.toThrow();
    expect(() => assertCanReject('open')).toThrow(/Only a submitted session/);
  });

  it('blocks the submitter from approving their own session', () => {
    expect(() => assertIndependentApprover('user-a', 'user-b')).not.toThrow();
    try {
      assertIndependentApprover('user-a', 'user-a');
      throw new Error('expected independent approval to fail');
    } catch (error) {
      expect(error).toMatchObject({ errorCode: ERROR_CODES.STOCK_TAKE_INDEPENDENT_APPROVAL });
    }
  });
});
