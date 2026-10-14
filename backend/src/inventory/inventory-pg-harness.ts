import { readFileSync } from 'fs';
import { join } from 'path';
import { assertDisposableInventoryTestUrl } from '../common/isolated-database';

type PgResult = { rowCount: number | null; rows: Record<string, unknown>[] };
export type InventoryPgClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<PgResult>;
  end(): Promise<void>;
};

const { Client } = require('pg') as {
  Client: new (opts: { connectionString: string }) => InventoryPgClient;
};

export const INVENTORY_TEST_DATABASE_URL = process.env.INVENTORY_TEST_DATABASE_URL ?? '';

export function inventoryPgConfigured() {
  return Boolean(INVENTORY_TEST_DATABASE_URL);
}

export async function connectInventoryTestClient(): Promise<InventoryPgClient> {
  if (!INVENTORY_TEST_DATABASE_URL) {
    throw new Error('INVENTORY_TEST_DATABASE_URL is not set');
  }
  assertDisposableInventoryTestUrl(INVENTORY_TEST_DATABASE_URL);
  const client = new Client({ connectionString: INVENTORY_TEST_DATABASE_URL });
  await client.connect();
  const identity = await client.query('SELECT current_database() AS db, current_user AS usr');
  const db = String(identity.rows[0]?.db ?? '');
  const usr = String(identity.rows[0]?.usr ?? '');
  if (db !== 'inventory_it' || usr !== 'inventory_it') {
    await client.end();
    throw new Error(
      `Refusing session identity ${usr}@${db}. Disposable inventory tests require inventory_it/inventory_it.`,
    );
  }
  return client;
}

export async function resetInventoryItSchema(client: InventoryPgClient) {
  const sql = readFileSync(join(__dirname, 'sql/inventory-integrity-isolated-fixture.sql'), 'utf8');
  for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
    await client.query(statement);
  }
}
