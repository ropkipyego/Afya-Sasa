/**
 * Demo / development seed must never run against a production hospital database.
 * Historical migrations already recorded in public.migrations will not re-run;
 * this guard blocks a fresh apply if someone later re-enables TYPEORM_MIGRATIONS_RUN.
 */
export function demoSeedIsAllowed(env = process.env): boolean {
  const production =
    env.NODE_ENV === 'production' || env.AFYASASA_PRODUCTION === 'true';
  if (production && env.AFYASASA_ALLOW_DEMO_SEED === 'true') {
    throw new Error(
      'AFYASASA_ALLOW_DEMO_SEED cannot be enabled in production. Demo patients, staff, and stock must stay isolated.',
    );
  }
  return env.AFYASASA_ALLOW_DEMO_SEED === 'true';
}
