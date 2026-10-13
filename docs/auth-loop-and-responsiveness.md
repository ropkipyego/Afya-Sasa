# Authentication loop, hardening, and local responsiveness

Local-only work. No production stack, database, migration, MFA policy, commit, or push.

## Root cause of the login / password-change loop

Two defects combined:

1. **Access-token invalidation clock mismatch.** Password change called `invalidateUser()`, which stored `Date.now()` (milliseconds). The JWT guard compared `iat * 1000 < invalidatedAt`. JWT `iat` is whole seconds, so tokens issued in the same second as the password change were treated as already revoked. The next API call (`/auth/me`, notifications, refresh) returned 401, refresh issued another same-second token that was also revoked, and the client cleared the session. Staff who still had `forcePasswordChange` landed on login → forced change → 401 → login again.

2. **Overlapping refresh-token rotation.** `/auth/refresh` revokes the previous refresh token. Password change also calls `logoutAll`. Concurrent interval refresh, 401 retry, and bootstrap revalidation could rotate or revoke each other’s tokens. A stale failure then called `clearSession()`.

Guards were not disabled. 401 handling remains; it now refuses to drop a newer session generation.

## Session policy chosen

- **Authenticated password change:** verify current password, confirm new password, bcrypt-hash, audit `password_changed`, revoke other sessions, issue a new access/refresh pair, set the refresh cookie, keep the user in the application.
- **Recovery-link reset:** validate single-use hashed token, confirm password, persist hash, consume token, revoke all sessions, **do not** auto-login, show success and return to the login form once.

## OTP / passkeys

Email OTP primitives exist behind `AUTH_MFA_OTP_ENABLED=false` and `AUTH_MFA_OTP_REQUIRED=false`. Codes are hashed, 90s TTL, single-use, previous challenges overwritten, IP/user/challenge limits applied. TOTP and passkeys are **not** implemented. Email OTP must not be the only factor for privileged hospital accounts. Rollout blockers: enrollment UI, authenticator-app TOTP, recovery codes, helpdesk procedure, and an approved staged policy.

## Performance

HTTP logs already include `requestId` and `durationMs`; they now mark `slow` when over `HTTP_SLOW_MS` (default 500). TypeORM `maxQueryExecutionTime` is 500ms. Duplicate notification polling was aligned to 30s with a shared query key. Patient typeahead is debounced 300ms and cancelled via `AbortSignal`.

Live p50/p95/p99 against this workstation is recorded in the handover only if a local API answered `/health`. Do not treat Redis as an automatic speedup. Patient-identifiable GET responses are not cached across users.
