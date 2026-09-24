import {
  accessTokenTtlSeconds,
  authCookieSecure,
  inactivityTimeoutSeconds,
  inactivityWarningSeconds,
  sessionPolicy,
} from './session-policy';

describe('session policy', () => {
  it('defaults inactivity to two minutes', () => {
    expect(inactivityTimeoutSeconds({})).toBe(120);
    expect(inactivityWarningSeconds({})).toBe(30);
  });

  it('reads a single env value', () => {
    expect(inactivityTimeoutSeconds({ AUTH_INACTIVITY_TIMEOUT_SECONDS: '180' })).toBe(180);
  });

  it('rejects unsafe low timeouts', () => {
    expect(inactivityTimeoutSeconds({ AUTH_INACTIVITY_TIMEOUT_SECONDS: '5' })).toBe(120);
  });

  it('parses access token TTL', () => {
    expect(accessTokenTtlSeconds({ JWT_ACCESS_TTL: '15m' })).toBe(900);
    expect(accessTokenTtlSeconds({ JWT_ACCESS_TTL: '2m' })).toBe(120);
  });

  it('keeps cookies insecure on local HTTP unless forced', () => {
    expect(authCookieSecure({ NODE_ENV: 'development' })).toBe(false);
    expect(authCookieSecure({ AUTH_COOKIE_SECURE: 'true' })).toBe(true);
  });

  it('centralizes the policy object', () => {
    const policy = sessionPolicy({ AUTH_INACTIVITY_TIMEOUT_SECONDS: '120' });
    expect(policy.inactivityTimeoutSeconds).toBe(120);
    expect(policy.refreshCookie).toBe('afyasasa_refresh');
  });
});
