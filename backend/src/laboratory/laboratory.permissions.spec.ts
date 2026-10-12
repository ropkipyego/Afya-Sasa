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

describe('laboratory permission guard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  function requireKeys(...keys: string[]) {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(keys);
  }

  it('denies cancel without lab_requests:cancel even if the user can enter results', () => {
    requireKeys('lab_requests:cancel');
    expect(() => guard.canActivate(contextWith(['lab_results:enter', 'lab_results:verify']))).toThrow(
      ForbiddenException,
    );
  });

  it('denies amend without lab_results:amend', () => {
    requireKeys('lab_results:amend');
    expect(() => guard.canActivate(contextWith(['lab_results:verify', 'lab_results:read']))).toThrow(
      ForbiddenException,
    );
  });

  it('denies report access without lab_results:read', () => {
    requireKeys('lab_results:read');
    expect(() => guard.canActivate(contextWith(['lab_requests:read']))).toThrow(ForbiddenException);
  });

  it('allows report access with lab_results:read', () => {
    requireKeys('lab_results:read');
    expect(guard.canActivate(contextWith(['lab_results:read']))).toBe(true);
  });

  it('allows cancel only when lab_requests:cancel is present', () => {
    requireKeys('lab_requests:cancel');
    expect(guard.canActivate(contextWith(['lab_requests:cancel']))).toBe(true);
  });

  it('does not treat metadata key as a wildcard', () => {
    expect(REQUIRED_PERMISSIONS_KEY).toBe('requiredPermissions');
    requireKeys('lab_attachments:create');
    expect(() => guard.canActivate(contextWith(['lab_results:read']))).toThrow(ForbiddenException);
  });
});
