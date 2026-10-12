import { SHA_ELIGIBILITY_TIMEOUT_MS, SHA_TOKEN_TIMEOUT_MS, ShaClient } from './sha.client';

describe('ShaClient', () => {
  it('is not ready without facility and client credentials', () => {
    const client = new ShaClient({
      get: () => undefined,
    } as never);
    expect(client.credentialsReady()).toBe(false);
  });

  it('is ready only when id, secret and facility FR code are all set', () => {
    const env: Record<string, string> = {
      SHA_CLIENT_ID: 'id',
      SHA_CLIENT_SECRET: 'secret',
      SHA_FACILITY_FR_CODE: 'FR-1',
    };
    const client = new ShaClient({
      get: (key: string) => env[key],
    } as never);
    expect(client.credentialsReady()).toBe(true);
  });

  it('uses bounded timeouts and does not treat configuration as a live eligibility proof', () => {
    expect(SHA_ELIGIBILITY_TIMEOUT_MS).toBe(15_000);
    expect(SHA_TOKEN_TIMEOUT_MS).toBe(10_000);
  });
});
