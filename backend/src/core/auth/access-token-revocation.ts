/**
 * JWT `iat` is unix seconds. Redis previously stored Date.now() milliseconds.
 * Tokens issued in the same second as password-change invalidation were treated
 * as already revoked, which bounced staff back to login.
 */
export function invalidationEpochSeconds(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
}

export function isIssuedBeforeInvalidation(
  issuedAtSeconds: number,
  invalidatedAtRaw: string | null | undefined,
): boolean {
  const invalidatedAt = invalidationEpochSeconds(invalidatedAtRaw);
  if (invalidatedAt === null) return false;
  return issuedAtSeconds < invalidatedAt;
}
