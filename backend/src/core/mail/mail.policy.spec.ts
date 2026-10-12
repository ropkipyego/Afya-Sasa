import {
  APPROVED_SENDER,
  isValidEmailAddress,
  parseMailOverlay,
  purposeCategory,
  senderIsApproved,
} from './mail.policy';

describe('mail policy', () => {
  it('accepts only the approved Jalaram sender', () => {
    expect(senderIsApproved(APPROVED_SENDER)).toBe(true);
    expect(senderIsApproved('Noreply@Jalaram.co.ke')).toBe(true);
    expect(senderIsApproved('admin@jalaram.co.ke')).toBe(false);
  });

  it('rejects malformed recipients', () => {
    expect(isValidEmailAddress('ict@jalaram.co.ke')).toBe(true);
    expect(isValidEmailAddress('not-an-email')).toBe(false);
  });

  it('maps purposes onto policy categories', () => {
    expect(purposeCategory('password_reset')).toBe('auth');
    expect(purposeCategory('password_changed')).toBe('account');
    expect(purposeCategory('system_alert')).toBe('operational');
    expect(purposeCategory('internal_report')).toBe('reports');
  });

  it('hydrates overlay without copying unknown secret fields', () => {
    const overlay = parseMailOverlay({
      operatorDeliveryRequested: true,
      recipientAllowlist: ['ict@jalaram.co.ke', 'bad'],
      smtpPassword: 'do-not-keep',
    });
    expect(overlay.operatorDeliveryRequested).toBe(true);
    expect(overlay.recipientAllowlist).toEqual(['ict@jalaram.co.ke']);
    expect(JSON.stringify(overlay)).not.toContain('smtpPassword');
    expect(JSON.stringify(overlay)).not.toContain('do-not-keep');
  });
});
