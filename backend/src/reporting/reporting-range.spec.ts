import { BadRequestException } from '@nestjs/common';
import { parseIsoDateRange } from './reporting.service';
import { MARKETING_SOURCES } from '../marketing/marketing.constants';

describe('Director date filters', () => {
  it('parses an inclusive ISO range', () => {
    const { start, end } = parseIsoDateRange('2026-10-01', '2026-10-02');
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-02T23:59:59.999Z');
  });

  it('rejects an inverted or invalid range', () => {
    expect(() => parseIsoDateRange('2026-10-02', '2026-10-01')).toThrow(BadRequestException);
    expect(() => parseIsoDateRange('not-a-date', '2026-10-01')).toThrow(BadRequestException);
  });
});

describe('Marketing source vocabulary', () => {
  it('exposes the controlled acquisition sources without inventing history', () => {
    expect(MARKETING_SOURCES).toEqual([
      'Google',
      'Website',
      'WhatsApp',
      'Facebook',
      'Instagram',
      'TikTok',
      'Referral',
      'Existing patient',
      'Walk-in',
      'Other',
    ]);
  });
});
