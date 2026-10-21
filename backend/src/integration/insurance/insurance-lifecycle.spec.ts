import {
  assertClaimTransition,
  canTransitionClaim,
  claimIsCashEquivalent,
  claimIsRemittanceStatus,
  claimTransitionRequiresReason,
  eligibilityVerificationKind,
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

  it('keeps remittance distinct from operational claim statuses', () => {
    expect(claimIsRemittanceStatus('approved')).toBe(false);
    expect(claimIsRemittanceStatus('settled')).toBe(true);
    expect(claimTransitionRequiresReason('settled')).toBe(true);
    expect(claimTransitionRequiresReason('prepared')).toBe(false);
  });

  it('does not label stub or disconnected SHA rows as verified insurer responses', () => {
    expect(eligibilityVerificationKind('live')).toBe('verified_insurer_response');
    expect(eligibilityVerificationKind('stub')).toBe('practice_mode_not_live');
    expect(eligibilityVerificationKind('disconnected')).toBe('recorded_without_insurer_response');
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
