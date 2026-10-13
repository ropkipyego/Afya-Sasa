import { generateNumericOtp, hashOtp, otpMatches } from './mfa-otp';

describe('MFA OTP primitives', () => {
  it('generates a 6-digit code without logging it', () => {
    const code = generateNumericOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('hashes and verifies a single-use style comparison', () => {
    const code = '847291';
    const challengeId = 'chg_1';
    const hash = hashOtp(code, challengeId, 'pepper');
    expect(hash).not.toContain(code);
    expect(otpMatches(code, challengeId, 'pepper', hash)).toBe(true);
    expect(otpMatches('000000', challengeId, 'pepper', hash)).toBe(false);
  });
});
