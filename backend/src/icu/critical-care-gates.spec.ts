import { BadRequestException } from '@nestjs/common';
import {
  assertCriticalCareBed,
  assertCriticalCareChartOpen,
  isCriticalCareBed,
} from './critical-care-gates';

describe('critical care gates', () => {
  it('blocks charting after the overlay is closed', () => {
    expect(() => assertCriticalCareChartOpen('discharged', 'ICU')).toThrow(BadRequestException);
    expect(() => assertCriticalCareChartOpen('active', 'HDU')).not.toThrow();
  });

  it('accepts ICU ward or ICU bed type', () => {
    expect(isCriticalCareBed({ type: 'standard', ward: { type: 'icu' } }, 'icu')).toBe(true);
    expect(isCriticalCareBed({ type: 'icu', ward: { type: 'general' } }, 'icu')).toBe(true);
    expect(isCriticalCareBed({ type: 'standard', ward: { type: 'general' } }, 'icu')).toBe(false);
  });

  it('rejects a general bed for HDU', () => {
    expect(() =>
      assertCriticalCareBed({ type: 'standard', ward: { type: 'general' } }, 'hdu'),
    ).toThrow(/HDU bed/);
  });
});
