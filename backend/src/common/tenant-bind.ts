import { ForbiddenException } from '@nestjs/common';
import { defaultTenantCode, tenantLookupCodes } from './tenant-defaults';

export function tenantsEquivalent(left?: string | null, right?: string | null): boolean {
  if (!left?.trim() || !right?.trim()) return false;
  const a = new Set(tenantLookupCodes(left));
  return tenantLookupCodes(right).some((code) => a.has(code));
}

/**
 * Access tokens issued after this change carry `tid` (tenant code).
 * Legacy tokens without `tid` are accepted only for the configured default hospital.
 */
export function assertAccessTenantMatches(params: {
  tokenTenantCode?: string | null;
  requestTenantCode?: string | null;
}): void {
  const requestTenant = params.requestTenantCode?.trim();
  if (!requestTenant) {
    throw new ForbiddenException('Tenant context is required');
  }
  const tokenTenant = params.tokenTenantCode?.trim();
  if (tokenTenant) {
    if (!tenantsEquivalent(tokenTenant, requestTenant)) {
      throw new ForbiddenException('Tenant context does not match this session');
    }
    return;
  }
  if (!tenantsEquivalent(requestTenant, defaultTenantCode())) {
    throw new ForbiddenException('Tenant context does not match this session');
  }
}
