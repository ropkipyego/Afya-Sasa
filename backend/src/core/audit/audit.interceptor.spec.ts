import { actionFromRequest, shouldSkipAudit } from './audit.interceptor';

describe('AuditInterceptor helpers', () => {
  it('maps common HTTP methods to clinical audit actions', () => {
    expect(actionFromRequest('GET', '/api/v1/patients/1')).toBe('read');
    expect(actionFromRequest('POST', '/api/v1/patients')).toBe('create');
    expect(actionFromRequest('PATCH', '/api/v1/patients/1')).toBe('update');
    expect(actionFromRequest('DELETE', '/api/v1/patients/1')).toBe('delete');
  });

  it('prioritises export, print, and download actions', () => {
    expect(actionFromRequest('GET', '/api/v1/reports/export')).toBe('export');
    expect(actionFromRequest('GET', '/api/v1/patients/1/print-card')).toBe('print');
    expect(actionFromRequest('GET', '/api/v1/files/download')).toBe('download');
  });

  it('skips noisy operational endpoints', () => {
    expect(shouldSkipAudit('/api/v1/health')).toBe(true);
    expect(shouldSkipAudit('/docs')).toBe(true);
    expect(shouldSkipAudit('/api/v1/patients')).toBe(false);
  });
});
