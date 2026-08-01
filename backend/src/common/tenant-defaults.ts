import type { RequestContext } from './request-context';

/** Login / API tenant code for single-hospital deploys (default: jalaram). */
export function defaultTenantCode(): string {
  return process.env.DEFAULT_TENANT_CODE?.trim() || 'jalaram';
}

/** Realtime channel key — prefer request tenant, fall back to configured default. */
export function tenantChannel(request?: Pick<RequestContext, 'tenant'>): string {
  return request?.tenant?.code ?? defaultTenantCode();
}

/** Legacy hospital code still accepted during cutover. */
export function tenantLookupCodes(identifier: string): string[] {
  const normalized = identifier.trim().toLowerCase();
  if (normalized === 'demo') return ['jalaram', 'demo'];
  return [normalized];
}
