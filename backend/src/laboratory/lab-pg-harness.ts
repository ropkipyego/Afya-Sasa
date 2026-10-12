import { readFileSync } from 'fs';
import { join } from 'path';
import { assertIsolatedPostgresUrl } from '../common/isolated-database';

type PgQueryResult = { rowCount: number | null; rows: Record<string, unknown>[] };
export type LabPgClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<PgQueryResult>;
  end(): Promise<void>;
};
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => LabPgClient };

export const LAB_TEST_DATABASE_URL = process.env.LAB_TEST_DATABASE_URL ?? '';

export function labPgConfigured() {
  return Boolean(LAB_TEST_DATABASE_URL);
}

export function loadSql(relativeFromSrc: string) {
  return readFileSync(join(__dirname, relativeFromSrc), 'utf8');
}

export async function connectLabTestClient(): Promise<LabPgClient> {
  if (!LAB_TEST_DATABASE_URL) {
    throw new Error('LAB_TEST_DATABASE_URL is not set');
  }
  assertIsolatedPostgresUrl(LAB_TEST_DATABASE_URL, 'LAB_TEST_DATABASE_URL');
  const client = new Client({ connectionString: LAB_TEST_DATABASE_URL });
  await client.connect();
  return client;
}

export async function resetIsolatedLabSchema(client: LabPgClient) {
  await client.query('DROP SCHEMA IF EXISTS demo CASCADE');
  await client.query(loadSql('sql/lab-integrity-isolated-fixture.sql'));
}

export async function applyPlannedLabSql(client: LabPgClient) {
  await client.query(loadSql('../database/sql/planned/20261012_lab_integrity_lifecycle.sql'));
}

export async function rollbackPlannedLabSql(client: LabPgClient) {
  await client.query(loadSql('../database/sql/planned/20261012_lab_integrity_lifecycle.rollback.sql'));
}

export function loadDuplicateAuditSql() {
  return loadSql('../database/sql/planned/20261012_lab_duplicate_audit.read-only.sql');
}

export async function seedSyntheticLabGraph(client: LabPgClient) {
  const ids = {
    patientA: 'aaaaaaaa-0000-4000-8000-000000000001',
    patientB: 'bbbbbbbb-0000-4000-8000-000000000002',
    encounterA: 'aaaaaaaa-1111-4000-8000-000000000001',
    requestLegacy: '11111111-0000-4000-8000-000000000001',
    requestCatalog: '22222222-0000-4000-8000-000000000001',
    itemLegacy: '11111111-1111-4000-8000-000000000001',
    itemCatalog: '22222222-1111-4000-8000-000000000001',
    sampleCatalog: '22222222-2222-4000-8000-000000000001',
    orderable: '33333333-0000-4000-8000-000000000001',
    paramWbc: '33333333-1111-4000-8000-000000000001',
    paramHgb: '33333333-1111-4000-8000-000000000002',
    legacyTest: '44444444-0000-4000-8000-000000000001',
    resultLegacy: '55555555-0000-4000-8000-000000000001',
    resultWbc: '55555555-1111-4000-8000-000000000001',
  };

  await client.query(
    `INSERT INTO demo.patients (id, patient_no, first_name, last_name, gender, date_of_birth)
     VALUES ($1, 'SYN-A', 'Synthetic', 'Alpha', 'male', '1990-01-01'),
            ($2, 'SYN-B', 'Synthetic', 'Beta', 'female', '1985-06-01')`,
    [ids.patientA, ids.patientB],
  );
  await client.query(
    `INSERT INTO demo.encounters (id, patient_id) VALUES ($1, $2)`,
    [ids.encounterA, ids.patientA],
  );
  await client.query(
    `INSERT INTO demo.lab_tests (id, name, code, sample_type, reference_range, unit)
     VALUES ($1, 'Haemoglobin', 'HB-LEGACY', 'whole_blood', '12-16', 'g/dL')`,
    [ids.legacyTest],
  );
  await client.query(
    `INSERT INTO demo.lab_orderable_tests (id, code, name, is_panel)
     VALUES ($1, 'CBC-SYN', 'Synthetic CBC', true)`,
    [ids.orderable],
  );
  await client.query(
    `INSERT INTO demo.lab_test_parameters (id, orderable_test_id, code, name, unit, order_index)
     VALUES ($1, $3, 'WBC', 'White cells', 'x10^9/L', 1),
            ($2, $3, 'HGB', 'Haemoglobin', 'g/dL', 2)`,
    [ids.paramWbc, ids.paramHgb, ids.orderable],
  );
  await client.query(
    `INSERT INTO demo.lab_requests (id, patient_id, encounter_id, request_no, status)
     VALUES ($1, $3, $5, 'SYN-LAB-LEGACY', 'resulted'),
            ($2, $4, $5, 'SYN-LAB-CATALOG', 'processing')`,
    [ids.requestLegacy, ids.requestCatalog, ids.patientA, ids.patientB, ids.encounterA],
  );
  await client.query(
    `INSERT INTO demo.lab_request_items (id, request_id, test_id, orderable_test_id, status)
     VALUES ($1, $3, $5, NULL, 'resulted'),
            ($2, $4, NULL, $6, 'processing')`,
    [ids.itemLegacy, ids.itemCatalog, ids.requestLegacy, ids.requestCatalog, ids.legacyTest, ids.orderable],
  );
  await client.query(
    `INSERT INTO demo.lab_samples (id, request_id, barcode, type, collected_at)
     VALUES ($1, $2, 'SYN-SMP-1', 'blood', now())`,
    [ids.sampleCatalog, ids.requestCatalog],
  );
  await client.query(
    `INSERT INTO demo.lab_results (id, request_item_id, value, flag, unit, reference_range)
     VALUES ($1, $2, '13.2', 'normal', 'g/dL', '12-16')`,
    [ids.resultLegacy, ids.itemLegacy],
  );
  await client.query(
    `INSERT INTO demo.lab_results (id, request_item_id, parameter_id, value, flag, unit, reference_range)
     VALUES ($1, $2, $3, '7.1', 'unassessed', 'x10^9/L', 'Not established')`,
    [ids.resultWbc, ids.itemCatalog, ids.paramWbc],
  );
  return ids;
}
