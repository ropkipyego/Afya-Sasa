export function isIsolatedPostgresUrl(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function assertIsolatedPostgresUrl(connectionString: string, label: string) {
  if (!isIsolatedPostgresUrl(connectionString)) {
    throw new Error(
      `${label} must point at localhost/127.0.0.1. Refusing a remote database from this test harness.`,
    );
  }
}
