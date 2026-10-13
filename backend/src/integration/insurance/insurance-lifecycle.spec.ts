import {
  assertClaimTransition,
  canTransitionClaim,
  claimIsCashEquivalent,
  splitResponsibility,
} from './insurance-lifecycle';

describe('insurance claim lifecycle', () => {
  it('does not treat drafted or approved claims as cash', () => {
    expect(claimIsCashEquivalent('draft')).toBe(false);
    expect(claimIsCashEquivalent('approved')).toBe(false);
    expect(claimIsCashEquivalent('submitted_manual')).toBe(false);
    expect(claimIsCashEquivalent('settled')).toBe(true);
  });

  it('blocks skipped SHA portal submission', () => {
    expect(canTransitionClaim('draft', 'settled')).toBe(false);
    expect(() => assertClaimTransition('prepared', 'settled')).toThrow();
    expect(canTransitionClaim('prepared', 'submitted_manual')).toBe(true);
  });

  it('does not treat unapproved insurer estimates as guaranteed receivables', () => {
    const split = splitResponsibility({
      totalCharge: 1000,
      approvedAmount: null,
      patientShare: 200,
      amountReceived: 200,
    });
    expect(split.guaranteedReceivable).toBe(false);
    expect(split.remainingInsurerReceivable).toBeNull();
  });
});
