import { demoSeedIsAllowed } from './demo-seed-guard';

describe('demoSeedIsAllowed', () => {
  it('is off unless explicitly opted in', () => {
    expect(demoSeedIsAllowed({ AFYASASA_ALLOW_DEMO_SEED: 'false' })).toBe(false);
    expect(demoSeedIsAllowed({ AFYASASA_ALLOW_DEMO_SEED: 'true' })).toBe(true);
  });

  it('refuses demo seed in production even if the flag is true', () => {
    expect(() =>
      demoSeedIsAllowed({ NODE_ENV: 'production', AFYASASA_ALLOW_DEMO_SEED: 'true' }),
    ).toThrow(/cannot be enabled in production/);
  });
});
