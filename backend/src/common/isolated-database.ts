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

const LIVE_DB_NAMES = new Set([
  'afya',
  'afyasasa',
  'jalaram',
  'sokoos',
  'postgres',
  'demo',
]);

export function parseDatabaseName(connectionString: string) {
  try {
    return decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, '') || '');
  } catch {
    return '';
  }
}

function assertNamedDisposableUrl(
  connectionString: string,
  label: string,
  requiredDatabase: string,
) {
  assertIsolatedPostgresUrl(connectionString, label);
  const name = parseDatabaseName(connectionString).toLowerCase();
  if (!name || name !== requiredDatabase) {
    throw new Error(
      `${label} database name must be ${requiredDatabase}. Refusing any other local database.`,
    );
  }
  if (LIVE_DB_NAMES.has(name)) {
    throw new Error('Refusing a live or shared database name.');
  }
}

/** Disposable inventory tests only. Identity is the database name, not the port. */
export function assertDisposableInventoryTestUrl(connectionString: string) {
  assertNamedDisposableUrl(connectionString, 'INVENTORY_TEST_DATABASE_URL', 'inventory_it');
}

/** Disposable laboratory tests only. Identity is the database name, not the port. */
export function assertDisposableLabTestUrl(connectionString: string) {
  assertNamedDisposableUrl(connectionString, 'LAB_TEST_DATABASE_URL', 'lab_it');
}
