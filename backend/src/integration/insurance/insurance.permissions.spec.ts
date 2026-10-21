import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../../core/auth/auth.decorators';
import { PermissionsGuard } from '../../core/auth/auth.guards';
import { InsuranceController } from './insurance.controller';

function contextWith(permissions: string[]) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'u1', permissions } }),
    }),
  } as never;
}

function keysOn(method: keyof InsuranceController): string[] {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, InsuranceController.prototype[method]) ?? [];
}

describe('insurance route permissions', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  function requireKeys(...keys: string[]) {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(keys);
  }

  it('lists a distinct permission for view, prepare, payer admin, and claim transition', () => {
    expect(keysOn('workspace')).toEqual(['payments:read']);
    expect(keysOn('prepare')).toEqual(['payments:read', 'payments:initiate', 'payments:manage']);
    expect(keysOn('savePayer')).toEqual(['settings:manage', 'payments:manage']);
    expect(keysOn('transition')).toEqual(['payments:read', 'payments:initiate', 'payments:manage']);
  });

  it('denies workspace to a registrar who only has patients:read', () => {
    requireKeys(...keysOn('workspace'));
    expect(() => guard.canActivate(contextWith(['patients:read']))).toThrow(ForbiddenException);
  });

  it('allows workspace for claims officer and cashier payments:read', () => {
    requireKeys(...keysOn('workspace'));
    expect(guard.canActivate(contextWith(['payments:read']))).toBe(true);
    expect(guard.canActivate(contextWith(['payments:read', 'patients:read', 'encounters:read']))).toBe(true);
  });

  it('denies claim drafts without payments:read, initiate, or manage', () => {
    requireKeys(...keysOn('prepare'));
    expect(() => guard.canActivate(contextWith(['patients:read', 'encounters:read']))).toThrow(
      ForbiddenException,
    );
  });

  it('allows claim drafts for insurance officer payments:read without cashier initiate', () => {
    requireKeys(...keysOn('prepare'));
    expect(guard.canActivate(contextWith(['payments:read']))).toBe(true);
    expect(guard.canActivate(contextWith(['payments:initiate']))).toBe(true);
    expect(guard.canActivate(contextWith(['payments:manage']))).toBe(true);
  });

  it('denies payer catalogue changes without settings:manage or payments:manage', () => {
    requireKeys(...keysOn('savePayer'));
    expect(() => guard.canActivate(contextWith(['payments:read']))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextWith(['payments:initiate']))).toThrow(ForbiddenException);
  });

  it('allows operational claim transitions for payments:read and still denies patients:read-only', () => {
    requireKeys(...keysOn('transition'));
    expect(() => guard.canActivate(contextWith(['patients:read']))).toThrow(ForbiddenException);
    expect(guard.canActivate(contextWith(['payments:read']))).toBe(true);
    expect(guard.canActivate(contextWith(['payments:manage']))).toBe(true);
  });
});
