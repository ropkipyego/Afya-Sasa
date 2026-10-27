import { BadRequestException } from '@nestjs/common';
import {
  assertMayEnterTheatre,
  checklistStatusAfterNote,
  consentSatisfied,
  consentStatusAfterNote,
} from './theatre-lifecycle';

describe('theatre lifecycle', () => {
  it('lets emergency cases enter theatre without a signed consent', () => {
    expect(consentSatisfied({ consentStatus: 'pending', priority: 'emergency' })).toBe(true);
    expect(() =>
      assertMayEnterTheatre({
        consentStatus: 'pending',
        checklistStatus: 'complete',
        priority: 'emergency',
      }),
    ).not.toThrow();
  });

  it('blocks elective cases until consent and checklist are recorded', () => {
    expect(() =>
      assertMayEnterTheatre({
        consentStatus: 'pending',
        checklistStatus: 'complete',
        priority: 'elective',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertMayEnterTheatre({
        consentStatus: 'signed',
        checklistStatus: 'pending',
        priority: 'elective',
      }),
    ).toThrow(/checklist/);
  });

  it('promotes consent and checklist from the matching note types', () => {
    expect(consentStatusAfterNote('consent', 'pending')).toBe('signed');
    expect(checklistStatusAfterNote('checklist', 'pending')).toBe('complete');
    expect(consentStatusAfterNote('operation', 'pending')).toBe('pending');
  });
});
