import type { CookieOptions, Request, Response } from 'express';
import { AUTH_REFRESH_COOKIE, authCookieSecure, refreshTokenTtlMs } from './session-policy';

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: refreshTokenTtlMs(),
  };
}

export function readRefreshToken(request: Request, bodyToken?: string): string | undefined {
  const fromBody = bodyToken?.trim();
  if (fromBody) return fromBody;
  const fromCookie = request.cookies?.[AUTH_REFRESH_COOKIE];
  return typeof fromCookie === 'string' && fromCookie.trim() ? fromCookie.trim() : undefined;
}

export function setRefreshCookie(response: Response, rawToken: string) {
  response.cookie(AUTH_REFRESH_COOKIE, rawToken, refreshCookieOptions());
}

export function clearRefreshCookie(response: Response) {
  response.clearCookie(AUTH_REFRESH_COOKIE, {
    ...refreshCookieOptions(),
    maxAge: 0,
  });
}
