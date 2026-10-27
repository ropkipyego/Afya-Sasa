import {
  assertDisposableHmisSimRestoreUrl,
  assertDisposableHmisSimUrl,
  parseDatabaseName,
} from '../common/isolated-database';

type PgResult = { rowCount: number | null; rows: Record<string, unknown>[] };
export type HmisSimClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<PgResult>;
  end(): Promise<void>;
};

const { Client } = require('pg') as {
  Client: new (opts: { connectionString: string }) => HmisSimClient;
};

export const HMIS_SIM_DATABASE_URL = process.env.HMIS_SIM_DATABASE_URL ?? '';
export const HMIS_SIM_RESTORE_DATABASE_URL = process.env.HMIS_SIM_RESTORE_DATABASE_URL ?? '';

export function hmisSimConfigured() {
  return Boolean(HMIS_SIM_DATABASE_URL);
}

async function assertSession(client: HmisSimClient, expectedDb: string, expectedUser?: string) {
  const identity = await client.query('SELECT current_database() AS db, current_user AS usr');
  const db = String(identity.rows[0]?.db ?? '');
  const usr = String(identity.rows[0]?.usr ?? '');
  if (db !== expectedDb || (expectedUser && usr !== expectedUser)) {
    await client.end();
    throw new Error(
      `Refusing session identity ${usr}@${db}. Required ${expectedUser ?? '*'}@${expectedDb}.`,
    );
  }
  if (parseDatabaseName(`postgresql://x@127.0.0.1/${db}`).toLowerCase() === 'afyasasa') {
    await client.end();
    throw new Error('Refusing operational database afyasasa.');
  }
}

export async function connectHmisSim(): Promise<HmisSimClient> {
  if (!HMIS_SIM_DATABASE_URL) throw new Error('HMIS_SIM_DATABASE_URL is not set');
  assertDisposableHmisSimUrl(HMIS_SIM_DATABASE_URL);
  const client = new Client({ connectionString: HMIS_SIM_DATABASE_URL });
  await client.connect();
  await assertSession(client, 'hmis_sim', 'hmis_sim');
  return client;
}

export async function connectHmisSimRestore(): Promise<HmisSimClient> {
  if (!HMIS_SIM_RESTORE_DATABASE_URL) throw new Error('HMIS_SIM_RESTORE_DATABASE_URL is not set');
  assertDisposableHmisSimRestoreUrl(HMIS_SIM_RESTORE_DATABASE_URL);
  const client = new Client({ connectionString: HMIS_SIM_RESTORE_DATABASE_URL });
  await client.connect();
  await assertSession(client, 'hmis_sim_restore');
  return client;
}
