import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const MFA_OTP_TTL_SECONDS = 90;
export const MFA_OTP_LENGTH = 6;

export function generateNumericOtp(length = MFA_OTP_LENGTH): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += String(bytes[i] % 10);
  }
  return code;
}

export function hashOtp(code: string, challengeId: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${challengeId}:${code}`).digest('hex');
}

export function otpMatches(
  code: string,
  challengeId: string,
  pepper: string,
  storedHash: string,
): boolean {
  const computed = hashOtp(code, challengeId, pepper);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type MfaChallengeRecord = {
  userId: string;
  email: string;
  purpose: 'login' | 'step_up';
  codeHash: string;
  expiresAt: number;
  attempts: number;
};
