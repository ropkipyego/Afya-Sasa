export const AUTH_REFRESH_COOKIE = 'afyasasa_refresh';

export function inactivityTimeoutSeconds(env = process.env): number {
  const raw = Number(env.AUTH_INACTIVITY_TIMEOUT_SECONDS ?? 120);
  if (!Number.isFinite(raw) || raw < 30) return 120;
  return Math.min(Math.floor(raw), 8 * 60 * 60);
}

export function inactivityWarningSeconds(env = process.env): number {
  const timeout = inactivityTimeoutSeconds(env);
  const raw = Number(env.AUTH_INACTIVITY_WARNING_SECONDS ?? 30);
  if (!Number.isFinite(raw) || raw < 5) return Math.min(30, timeout);
  return Math.min(Math.floor(raw), timeout - 5);
}

export function accessTokenTtlSeconds(env = process.env): number {
  const ttl = env.JWT_ACCESS_TTL ?? '15m';
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 15 * 60;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 60 * 60;
  return value * 24 * 60 * 60;
}

export function refreshTokenTtlMs(env = process.env): number {
  const ttl = env.JWT_REFRESH_TTL ?? '7d';
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  return accessTokenTtlSeconds({ JWT_ACCESS_TTL: ttl } as NodeJS.ProcessEnv) * 1000;
}

export function authCookieSecure(env = process.env): boolean {
  if (env.AUTH_COOKIE_SECURE === 'true') return true;
  if (env.AUTH_COOKIE_SECURE === 'false') return false;
  return env.NODE_ENV === 'production';
}

export function sessionPolicy(env = process.env) {
  return {
    inactivityTimeoutSeconds: inactivityTimeoutSeconds(env),
    inactivityWarningSeconds: inactivityWarningSeconds(env),
    accessTokenTtlSeconds: accessTokenTtlSeconds(env),
    refreshCookie: AUTH_REFRESH_COOKIE,
  };
}
