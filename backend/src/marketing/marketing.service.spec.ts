import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import type { RequestContext } from '../common/request-context';

function actor(
  id: string,
  permissions: string[],
): RequestContext {
  return {
    user: { sub: id, email: `${id}@test`, roles: [], permissions },
  } as RequestContext;
}

describe('MarketingService ownership and validation', () => {
  let service: MarketingService;

  beforeEach(() => {
    service = new MarketingService(
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('uses the authenticated user as owner by default', () => {
    const request = actor('marketer-1', ['marketing:create']);
    expect(service.resolveOwnerUserId(undefined, request)).toBe('marketer-1');
    expect(service.resolveOwnerUserId('marketer-1', request)).toBe('marketer-1');
  });

  it('blocks a marketer from creating an activity for another user', () => {
    const request = actor('marketer-1', ['marketing:create']);
    expect(() => service.resolveOwnerUserId('someone-else', request)).toThrow(ForbiddenException);
  });

  it('allows a manager to create an activity for another staff member', () => {
    const request = actor('admin-1', ['marketing:manage']);
    expect(service.resolveOwnerUserId('marketer-2', request)).toBe('marketer-2');
  });

  it('rejects negative people, leads, and referrals', () => {
    expect(() =>
      service.assertActivityRules({ activityDate: '2026-09-11', peopleReached: -1 }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertActivityRules({ activityDate: '2026-09-11', leadsGenerated: -2 }),
    ).toThrow(/Leads generated cannot be negative/);
    expect(() =>
      service.assertActivityRules({ activityDate: '2026-09-11', referralsGenerated: -3 }),
    ).toThrow(/Referrals generated cannot be negative/);
  });

  it('requires a follow-up date when a follow-up is needed', () => {
    expect(() =>
      service.assertActivityRules({ activityDate: '2026-09-11', followUpRequired: true }),
    ).toThrow(/Follow-up date is required/);
  });

  it('rejects a follow-up date before the activity date', () => {
    expect(() =>
      service.assertActivityRules({
        activityDate: '2026-09-11',
        followUpRequired: true,
        followUpDate: '2026-09-10',
      }),
    ).toThrow(/cannot be before the activity date/);
  });

  it('accepts a valid follow-up on or after the activity date', () => {
    expect(() =>
      service.assertActivityRules({
        activityDate: '2026-09-11',
        followUpRequired: true,
        followUpDate: '2026-09-12',
        peopleReached: 0,
      }),
    ).not.toThrow();
  });
});
