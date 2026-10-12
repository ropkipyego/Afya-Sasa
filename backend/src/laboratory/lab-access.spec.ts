import {
  canAccessStructuredLabReport,
  canAmendLabResult,
  canCancelLabRequest,
} from './lab-access';

describe('laboratory access control', () => {
  const request = { createdBy: 'doctor-1' };

  it('denies structured reports to a reader who did not create the request', () => {
    expect(
      canAccessStructuredLabReport(
        { sub: 'other', roles: ['doctor'], permissions: ['lab_results:read'] },
        request,
      ),
    ).toBe(false);
  });

  it('allows the ordering clinician who created the request', () => {
    expect(
      canAccessStructuredLabReport(
        { sub: 'doctor-1', roles: ['doctor'], permissions: ['lab_results:read'] },
        request,
      ),
    ).toBe(true);
  });

  it('allows laboratory staff who can verify', () => {
    expect(
      canAccessStructuredLabReport(
        { sub: 'tech-1', roles: ['lab_technician'], permissions: ['lab_results:read', 'lab_results:verify'] },
        request,
      ),
    ).toBe(true);
  });

  it('denies cancel and amend unless those exact keys are present', () => {
    const tech = {
      sub: 'tech-1',
      permissions: ['lab_results:enter', 'lab_results:verify', 'lab_results:read'],
    };
    expect(canCancelLabRequest(tech)).toBe(false);
    expect(canAmendLabResult(tech)).toBe(false);
    expect(canCancelLabRequest({ permissions: ['lab_requests:cancel'] })).toBe(true);
    expect(canAmendLabResult({ permissions: ['lab_results:amend'] })).toBe(true);
  });
});
