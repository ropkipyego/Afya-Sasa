import { QuickbooksWebConnectorService } from './quickbooks-webconnector.service';

describe('QuickbooksWebConnectorService authentication', () => {
  function service(env: Record<string, string> = {}) {
    return new QuickbooksWebConnectorService(
      { findOne: jest.fn(), update: jest.fn() } as never,
      { get: jest.fn((key: string) => env[key]) } as never,
    );
  }

  it('rejects authenticate when QBWC credentials are not configured', async () => {
    const qbwc = service({});
    const xml = await qbwc.handleSoapRequest(
      '<authenticate xmlns="http://developer.intuit.com/"><strUserName>a</strUserName><strPassword>b</strPassword></authenticate>',
      {} as never,
    );
    expect(xml).toContain('<string>nvu</string>');
    expect(xml).not.toContain('afyasasa-token');
  });

  it('rejects a wrong password', async () => {
    const qbwc = service({ QBWC_USER: 'afyasasa', QBWC_PASSWORD: 'correct-horse' });
    const xml = await qbwc.handleSoapRequest(
      '<authenticate xmlns="http://developer.intuit.com/"><strUserName>afyasasa</strUserName><strPassword>wrong</strPassword></authenticate>',
      {} as never,
    );
    expect(xml).toContain('<string>nvu</string>');
  });

  it('issues a ticket for matching credentials and rejects sendRequestXML without it', async () => {
    const qbwc = service({ QBWC_USER: 'afyasasa', QBWC_PASSWORD: 'correct-horse' });
    const auth = await qbwc.handleSoapRequest(
      '<authenticate xmlns="http://developer.intuit.com/"><strUserName>afyasasa</strUserName><strPassword>correct-horse</strPassword></authenticate>',
      {} as never,
    );
    expect(auth).not.toContain('nvu');
    expect(auth).not.toContain('afyasasa-token');
    const unauth = await qbwc.handleSoapRequest(
      '<sendRequestXML xmlns="http://developer.intuit.com/"><ticket>forged</ticket></sendRequestXML>',
      {} as never,
    );
    expect(unauth).toContain('<sendRequestXMLResult></sendRequestXMLResult>');
  });
});
