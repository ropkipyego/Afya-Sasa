import { ForbiddenException } from '@nestjs/common';
import { assertAccessTenantMatches, tenantsEquivalent } from './tenant-bind';

describe('tenant bind', () => {
  it('treats jalaram and demo as equivalent lookup aliases', () => {
    expect(tenantsEquivalent('jalaram', 'jalaram')).toBe(true);
    expect(tenantsEquivalent('demo', 'jalaram')).toBe(true);
    expect(tenantsEquivalent('jalaram', 'other-hospital')).toBe(false);
    expect(tenantsEquivalent('', 'jalaram')).toBe(false);
  });

  it('rejects a missing request tenant', () => {
    expect(() =>
      assertAccessTenantMatches({ tokenTenantCode: 'jalaram', requestTenantCode: null }),
    ).toThrow(ForbiddenException);
  });

  it('rejects an authenticated token used against a different tenant header', () => {
    expect(() =>
      assertAccessTenantMatches({
        tokenTenantCode: 'jalaram',
        requestTenantCode: 'city-clinic',
      }),
    ).toThrow(/does not match/);
  });

  it('accepts a matching tenant including the demo alias', () => {
    expect(() =>
      assertAccessTenantMatches({ tokenTenantCode: 'jalaram', requestTenantCode: 'demo' }),
    ).not.toThrow();
  });

  it('does not treat a blank token tenant as equivalent to a blank request tenant', () => {
    expect(tenantsEquivalent(null, 'jalaram')).toBe(false);
    expect(tenantsEquivalent('jalaram', undefined)).toBe(false);
  });

  it('allows legacy tokens only against the default hospital', () => {
    expect(() =>
      assertAccessTenantMatches({ tokenTenantCode: undefined, requestTenantCode: 'jalaram' }),
    ).not.toThrow();
    expect(() =>
      assertAccessTenantMatches({ tokenTenantCode: undefined, requestTenantCode: 'other' }),
    ).toThrow(/does not match/);
  });
});
