import 'reflect-metadata';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/auth.decorators';
import { MailController } from './mail.controller';

describe('MailController public status', () => {
  it('does not expose SMTP passwords in diagnostics', async () => {
    const mail = {
      diagnostics: () => ({
        fromAddress: 'noreply@jalaram.co.ke',
        smtpAuthConfigured: true,
        password: 'super-secret-mailbox',
        smtpPassword: 'super-secret-mailbox',
      }),
      verifyConnection: jest.fn(),
      sendAdministratorTest: jest.fn(),
    };
    const controller = new MailController(
      mail as never,
      { snapshot: () => ({}), hydrate: jest.fn(), replace: jest.fn() } as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() } as never,
    );
    const status = await controller.status({ tenant: { id: 't1' } } as never);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('super-secret-mailbox');
    expect(status).not.toHaveProperty('password');
    expect(status).not.toHaveProperty('smtpPassword');
  });

  it('requires settings:manage on email administration routes', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MailController.prototype.status)).toEqual([
      'settings:manage',
    ]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MailController.prototype.test)).toEqual([
      'settings:manage',
    ]);
  });
});
