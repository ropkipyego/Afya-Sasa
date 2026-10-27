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

/** Full HMIS simulation writes only. Never afyasasa. */
export function assertDisposableHmisSimUrl(connectionString: string) {
  assertNamedDisposableUrl(connectionString, 'HMIS_SIM_DATABASE_URL', 'hmis_sim');
}

/** Restore target for the HMIS simulation dump. Distinct from source and from afyasasa. */
export function assertDisposableHmisSimRestoreUrl(connectionString: string) {
  assertNamedDisposableUrl(connectionString, 'HMIS_SIM_RESTORE_DATABASE_URL', 'hmis_sim_restore');
}

const ALLOWED_RESTORE_DB_NAMES = new Set(['hmis_sim_restore']);

/** Named restore target only. Never afyasasa or any other live/shared catalog. */
export function assertDisposableRestoreTargetName(databaseName: string) {
  const name = String(databaseName ?? '').trim().toLowerCase();
  if (!name || LIVE_DB_NAMES.has(name)) {
    throw new Error('Refusing a live or shared restore target.');
  }
  if (!ALLOWED_RESTORE_DB_NAMES.has(name)) {
    throw new Error(
      'AFYASASA_RESTORE_TARGET_DB must be hmis_sim_restore. Refusing any other database name.',
    );
  }
  return name;
}

export function dumpMentionsOperationalDatabase(sql: string) {
  return /(\\connect\s+afyasasa\b)|(CREATE\s+DATABASE\s+afyasasa\b)/i.test(sql);
}
