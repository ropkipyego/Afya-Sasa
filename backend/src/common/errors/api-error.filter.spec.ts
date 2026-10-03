import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiErrorFilter } from './api-error.filter';
import { canViewDirectorFinance } from './director-access';
import { inferErrorCode, ERROR_CODES } from './error-codes';

describe('error envelope', () => {
  it('maps common statuses and payment duplicates', () => {
    expect(inferErrorCode(401, 'Missing bearer')).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(inferErrorCode(403, 'Permission denied')).toBe(ERROR_CODES.AUTH_FORBIDDEN);
    expect(inferErrorCode(404, 'Patient not found')).toBe(ERROR_CODES.PATIENT_NOT_FOUND);
    expect(inferErrorCode(400, 'A matching payment was just recorded.')).toBe(
      ERROR_CODES.PAYMENT_DUPLICATE,
    );
    expect(inferErrorCode(500, 'boom')).toBe(ERROR_CODES.INTERNAL_ERROR);
  });

  it('returns the stable envelope without a stack trace', () => {
    const filter = new ApiErrorFilter();
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    filter.catch(new UnauthorizedException('Missing bearer access token'), {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          header: () => 'req-1',
          headers: { 'x-request-id': 'req-1' },
          originalUrl: '/api/v1/patients',
          method: 'GET',
          user: undefined,
        }),
      }),
    } as never);

    expect(response.status).toHaveBeenCalledWith(401);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    expect(body.requestId).toBe('req-1');
    expect(JSON.stringify(body)).not.toMatch(/stack/i);
  });

  it('maps 403 and 404 through the same envelope', () => {
    const filter = new ApiErrorFilter();
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    filter.catch(new ForbiddenException('Permission denied'), {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          header: () => 'req-2',
          headers: {},
          originalUrl: '/api/v1/reports/executive-analytics',
          method: 'GET',
          user: { sub: 'u1', roles: ['doctor'] },
        }),
      }),
    } as never);
    expect(json.mock.calls[0][0].error.code).toBe(ERROR_CODES.AUTH_FORBIDDEN);

    json.mockClear();
    filter.catch(new NotFoundException('Encounter not found'), {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          header: () => 'req-3',
          headers: {},
          originalUrl: '/api/v1/opd/encounters/x',
          method: 'GET',
          user: { sub: 'u1', roles: ['nurse'] },
        }),
      }),
    } as never);
    expect(json.mock.calls[0][0].error.code).toBe(ERROR_CODES.ENCOUNTER_NOT_FOUND);
  });
});

describe('director finance access', () => {
  it('allows director, administrator, superadmin, and payments readers', () => {
    expect(canViewDirectorFinance({ roles: ['director'] })).toBe(true);
    expect(canViewDirectorFinance({ roles: ['administrator'] })).toBe(true);
    expect(canViewDirectorFinance({ roles: ['superadmin'] })).toBe(true);
    expect(canViewDirectorFinance({ permissions: ['payments:read'] })).toBe(true);
  });

  it('blocks a doctor who only has reports:read', () => {
    expect(
      canViewDirectorFinance({ roles: ['doctor'], permissions: ['reports:read'] }),
    ).toBe(false);
  });
});
