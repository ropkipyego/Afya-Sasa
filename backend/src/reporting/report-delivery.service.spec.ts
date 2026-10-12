import { ForbiddenException } from '@nestjs/common';
import { ReportDeliveryService } from './report-delivery.service';

function service(overrides: Record<string, unknown> = {}) {
  const instance = Object.create(ReportDeliveryService.prototype) as ReportDeliveryService;
  Object.assign(instance, {
    reports: {},
    mail: {
      runtimeConfig: () => ({ publicOrigin: 'https://emr.jalaram.co.ke' }),
      sendInternalReportNotice: jest.fn().mockResolvedValue({
        accepted: false,
        status: 'NOT_CONFIGURED',
        reason: 'EMAIL_DELIVERY_ENABLED is not true',
      }),
      sendGovernmentNotification: jest.fn().mockResolvedValue({
        accepted: false,
        status: 'FAILED',
        reason: 'connection timeout',
      }),
    },
    users: {
      collectRolesAndPermissions: jest.fn().mockResolvedValue({ permissions: ['reports:read'] }),
    },
    config: {
      get: jest.fn((key: string) =>
        key === 'EMAIL_GOVERNMENT_NOTIFY_ALLOWLIST' ? 'ops@jalaram.co.ke' : undefined,
      ),
    },
    userRows: {
      findOne: jest.fn().mockResolvedValue({
        id: 'u2',
        active: true,
        email: 'records@jalaram.co.ke',
      }),
    },
    deliveries: {
      save: jest.fn(async (row) => ({ id: 'r1', ...row })),
      create: jest.fn((row) => row),
      update: jest.fn(),
      findOne: jest.fn(),
    },
    ...overrides,
  });
  return instance;
}

const actor = {
  sub: 'u1',
  email: 'admin@jalaram.co.ke',
  roles: ['administrator'],
  permissions: ['reports:read'],
};

describe('ReportDeliveryService', () => {
  it('rejects a recipient who cannot read reports', async () => {
    const svc = service({
      users: { collectRolesAndPermissions: jest.fn().mockResolvedValue({ permissions: [] }) },
    });
    await expect(
      svc.deliverInternal(
        {
          reportType: 'dashboard',
          from: '2026-10-01',
          to: '2026-10-08',
          recipientUserId: 'u2',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects government mail to an unapproved recipient', async () => {
    const svc = service();
    await expect(
      svc.deliverGovernmentNotification(
        {
          kind: 'failure',
          integration: 'SHA',
          detail: 'HIE unreachable',
          recipientEmail: 'stranger@example.com',
        },
        { ...actor, permissions: ['reports:government_notify'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not fabricate a government acknowledgement on delivery failure', async () => {
    const svc = service();
    const result = await svc.deliverGovernmentNotification(
      {
        kind: 'failure',
        integration: 'SHA',
        detail: 'HIE unreachable',
        recipientEmail: 'ops@jalaram.co.ke',
      },
      { ...actor, permissions: ['reports:government_notify'] },
    );
    expect(result.accepted).toBe(false);
    expect(result.acknowledgement).toBe(false);
    expect(result.message).not.toMatch(/submitted|accepted by SHA|acknowledged/i);
  });
});
