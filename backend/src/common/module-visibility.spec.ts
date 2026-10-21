import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../core/auth/auth.guards';

/**
 * Keep in sync with frontend/src/lib/navigation.ts.
 * A hidden menu is not a security control — these keys are what the API must require.
 */
const MODULE_API_PERMISSIONS: Record<string, string[]> = {
  'Director Dashboard': ['reports:read'],
  'Cashier / Billing': ['payments:initiate'],
  'Insurance workspace': ['payments:read'],
  Interoperability: ['settings:manage', 'reports:read'],
  'Refund payment': ['payments:manage'],
};

function contextWith(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'u1', permissions } }),
    }),
  } as never;
}

describe('module API authorization', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  function requireKeys(...keys: string[]) {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(keys);
  }

  it('lets a director with reports:read open analytics', () => {
    requireKeys(...MODULE_API_PERMISSIONS['Director Dashboard']);
    expect(guard.canActivate(contextWith(['reports:read']))).toBe(true);
  });

  it('denies cashier collection without payments:initiate', () => {
    requireKeys(...MODULE_API_PERMISSIONS['Cashier / Billing']);
    expect(() => guard.canActivate(contextWith(['reports:read']))).toThrow(ForbiddenException);
  });

  it('denies FHIR status without settings:manage or reports:read', () => {
    requireKeys(...MODULE_API_PERMISSIONS.Interoperability);
    expect(() => guard.canActivate(contextWith(['patients:read']))).toThrow(ForbiddenException);
  });

  it('denies refunds without payments:manage', () => {
    requireKeys(...MODULE_API_PERMISSIONS['Refund payment']);
    expect(() => guard.canActivate(contextWith(['payments:initiate']))).toThrow(ForbiddenException);
  });

  it('denies insurance workspace without payments:read', () => {
    requireKeys(...MODULE_API_PERMISSIONS['Insurance workspace']);
    expect(() => guard.canActivate(contextWith(['patients:read']))).toThrow(ForbiddenException);
  });

  it('allows insurance workspace with payments:read', () => {
    requireKeys(...MODULE_API_PERMISSIONS['Insurance workspace']);
    expect(guard.canActivate(contextWith(['payments:read']))).toBe(true);
  });
});
