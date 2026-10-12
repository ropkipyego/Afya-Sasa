import { canAccessRadiologyReportContent, redactRadiologyAttachment } from './radiology-access';

describe('radiology report access', () => {
  const request = { createdBy: 'doc-1' };

  it('allows the ordering clinician, verifiers, and report readers', () => {
    expect(canAccessRadiologyReportContent({ sub: 'doc-1', permissions: [] }, request)).toBe(true);
    expect(
      canAccessRadiologyReportContent({ permissions: ['radiology_reports:read'] }, request),
    ).toBe(true);
    expect(
      canAccessRadiologyReportContent({ permissions: ['radiology_reports:verify'] }, request),
    ).toBe(true);
  });

  it('denies a clerk who can only see the worklist', () => {
    expect(
      canAccessRadiologyReportContent(
        { sub: 'clerk-1', permissions: ['radiology_requests:read'] },
        request,
      ),
    ).toBe(false);
  });

  it('strips storage paths from unauthorized attachment payloads', () => {
    expect(
      redactRadiologyAttachment({ filename: 'scan.pdf', storagePath: 'bucket/phi/scan.pdf' }),
    ).toEqual({
      filename: 'redacted',
      storagePath: undefined,
      redacted: true,
    });
  });
});
