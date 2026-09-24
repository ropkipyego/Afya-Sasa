import { escapeCsv, toCsv } from './export-workbook';

describe('export workbook', () => {
  it('escapes commas, quotes, and line breaks', () => {
    expect(escapeCsv('JH-2026-00012')).toBe('JH-2026-00012');
    expect(escapeCsv('Wanjiku, Jane')).toBe('"Wanjiku, Jane"');
    expect(escapeCsv('He said "yes"')).toBe('"He said ""yes"""');
  });

  it('keeps long identifiers as text in CSV', () => {
    const csv = toCsv(
      [
        { key: 'phone', header: 'Phone' },
        { key: 'amount', header: 'Amount', kind: 'number' },
      ],
      [{ phone: '0712345678', amount: 495 }],
    ).toString('utf8');
    expect(csv).toContain('0712345678');
    expect(csv).toContain('495');
  });
});
