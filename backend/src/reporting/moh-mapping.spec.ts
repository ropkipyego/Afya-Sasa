import { mohMappingReport } from './moh-mapping';

describe('MOH mapping report', () => {
  it('does not claim electronic submission', () => {
    const report = mohMappingReport();
    expect(report.electronicSubmissionOperational).toBe(false);
    expect(report.forms.some((form) => form.code === 'MOH705A' && form.endpoint)).toBe(true);
    expect(report.forms.find((form) => form.code === 'MOH204A')?.submission).toBe('requires_official_spec');
  });
});
