import { isIssuedBeforeInvalidation } from './access-token-revocation';

describe('access token invalidation clock', () => {
  it('keeps tokens issued in the same second as password-change rotation', () => {
    const nowMs = 1_717_000_123_456;
    const iat = Math.floor(nowMs / 1000);
    expect(isIssuedBeforeInvalidation(iat, String(nowMs))).toBe(false);
  });

  it('revokes tokens issued before the invalidation second', () => {
    const nowMs = 1_717_000_123_456;
    const iat = Math.floor(nowMs / 1000) - 1;
    expect(isIssuedBeforeInvalidation(iat, String(nowMs))).toBe(true);
  });

  it('accepts second-precision invalidation stamps', () => {
    expect(isIssuedBeforeInvalidation(100, '100')).toBe(false);
    expect(isIssuedBeforeInvalidation(99, '100')).toBe(true);
  });

  it('treats missing stamps as not revoked', () => {
    expect(isIssuedBeforeInvalidation(100, null)).toBe(false);
  });
});
