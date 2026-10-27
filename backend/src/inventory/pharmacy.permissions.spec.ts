import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../core/auth/auth.guards';
import { REQUIRED_PERMISSIONS_KEY } from '../core/auth/auth.decorators';

function contextWith(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'u1', permissions } }),
    }),
  } as never;
}

describe('pharmacy and clinical-order permission guard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  function requireKeys(...keys: string[]) {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(keys);
  }

  it('denies prescription dispense without pharmacy:dispense', () => {
    requireKeys('pharmacy:dispense');
    expect(() => guard.canActivate(contextWith(['pharmacy:read', 'patients:read']))).toThrow(
      ForbiddenException,
    );
  });

  it('allows physical issue only when pharmacy:dispense is present', () => {
    requireKeys('pharmacy:dispense');
    expect(guard.canActivate(contextWith(['pharmacy:dispense']))).toBe(true);
  });

  it('denies prescription create when the actor has only patients:read', () => {
    requireKeys('pharmacy:prescribe', 'consultations:create');
    expect(() => guard.canActivate(contextWith(['patients:read']))).toThrow(ForbiddenException);
  });

  it('allows prescription create with pharmacy:prescribe (OR semantics unchanged)', () => {
    requireKeys('pharmacy:prescribe', 'consultations:create');
    expect(guard.canActivate(contextWith(['pharmacy:prescribe']))).toBe(true);
  });

  it('denies sale cancel without pharmacy:dispense or payments:manage', () => {
    requireKeys('pharmacy:dispense', 'payments:manage');
    expect(() => guard.canActivate(contextWith(['pharmacy:read']))).toThrow(ForbiddenException);
  });

  it('does not treat a hidden navigation label as authorization', () => {
    expect(REQUIRED_PERMISSIONS_KEY).toBe('requiredPermissions');
    requireKeys('inventory:manage');
    expect(() => guard.canActivate(contextWith(['pharmacy:read']))).toThrow(ForbiddenException);
  });
});
