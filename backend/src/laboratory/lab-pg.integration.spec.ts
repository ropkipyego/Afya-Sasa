import {
  applyPlannedLabSql,
  connectLabTestClient,
  labPgConfigured,
  loadDuplicateAuditSql,
  rollbackPlannedLabSql,
  resetIsolatedLabSchema,
  seedSyntheticLabGraph,
} from './lab-pg-harness';

jest.setTimeout(30_000);

const describePg = labPgConfigured() ? describe : describe.skip;

describePg('laboratory PostgreSQL isolation (LAB_TEST_DATABASE_URL)', () => {
  let client: Awaited<ReturnType<typeof connectLabTestClient>>;

  beforeAll(async () => {
    client = await connectLabTestClient();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('applies planned SQL, keeps existing rows, and rolls back', async () => {
    await resetIsolatedLabSchema(client);
    const ids = await seedSyntheticLabGraph(client);

    await applyPlannedLabSql(client);
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'demo' AND table_name = 'lab_results'
         AND column_name IN ('result_comment', 'supersedes_id', 'amendment_reason')`,
    );
    expect(cols.rowCount).toBe(3);

    const perm = await client.query(
      `SELECT resource, action, permission_key FROM demo.permissions
       WHERE permission_key IN ('lab_results:amend', 'lab_requests:cancel')
       ORDER BY permission_key`,
    );
    expect(perm.rows.map((row) => row.permission_key)).toEqual([
      'lab_requests:cancel',
      'lab_results:amend',
    ]);
    const grants = await client.query(
      `SELECT 1 FROM demo.role_permissions rp
       JOIN demo.permissions p ON p.id = rp.permission_id
       WHERE p.permission_key IN ('lab_results:amend', 'lab_requests:cancel')`,
    );
    expect(grants.rowCount).toBe(0);

    const legacy = await client.query(`SELECT value, flag FROM demo.lab_results WHERE id = $1`, [
      ids.resultLegacy,
    ]);
    expect(legacy.rows[0]).toEqual({ value: '13.2', flag: 'normal' });
    const catalog = await client.query(`SELECT flag FROM demo.lab_results WHERE id = $1`, [
      ids.resultWbc,
    ]);
    expect(catalog.rows[0].flag).toBe('unassessed');

    await rollbackPlannedLabSql(client);
    const gone = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'demo' AND table_name = 'lab_results'
         AND column_name = 'supersedes_id'`,
    );
    expect(gone.rowCount).toBe(0);
    const still = await client.query(`SELECT value FROM demo.lab_results WHERE id = $1`, [
      ids.resultLegacy,
    ]);
    expect(still.rows[0].value).toBe('13.2');
  });

  it('does not overwrite a verified result in a save-versus-verify race', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);

    const a = await connectLabTestClient();
    const b = await connectLabTestClient();
    try {
      await a.query('BEGIN');
      await a.query(`SELECT id FROM demo.lab_requests WHERE id = $1 FOR UPDATE`, [ids.requestCatalog]);
      await a.query(
        `UPDATE demo.lab_results SET verified_at = now(), flag = 'unassessed' WHERE id = $1 AND verified_at IS NULL`,
        [ids.resultWbc],
      );
      await a.query(
        `UPDATE demo.lab_requests SET status = 'verified' WHERE id = $1 AND status IN ('resulted','processing','sample_collected')`,
        [ids.requestCatalog],
      );

      const save = b.query(
        `UPDATE demo.lab_results SET value = '99' WHERE id = $1 AND verified_at IS NULL`,
        [ids.resultWbc],
      );
      const raced = Promise.race([
        save,
        new Promise((_, reject) => setTimeout(() => reject(new Error('lock wait')), 250)),
      ]);
      await expect(raced).rejects.toThrow(/lock wait/);

      await a.query('COMMIT');
      const afterUnlock = await save;
      expect(afterUnlock.rowCount).toBe(0);
      const persisted = await client.query(`SELECT value, verified_at FROM demo.lab_results WHERE id = $1`, [
        ids.resultWbc,
      ]);
      expect(persisted.rows[0].value).toBe('7.1');
      expect(persisted.rows[0].verified_at).not.toBeNull();
    } finally {
      await a.end();
      await b.end();
    }
  });

  it('lets only one concurrent update of the same draft succeed', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);

    const a = await connectLabTestClient();
    const b = await connectLabTestClient();
    try {
      await a.query('BEGIN');
      await b.query('BEGIN');
      await a.query(`SELECT id FROM demo.lab_results WHERE id = $1 FOR UPDATE`, [ids.resultWbc]);
      const blocked = b.query(`SELECT id FROM demo.lab_results WHERE id = $1 FOR UPDATE`, [ids.resultWbc]);
      await a.query(`UPDATE demo.lab_results SET value = '8.0' WHERE id = $1 AND verified_at IS NULL`, [
        ids.resultWbc,
      ]);
      await a.query('COMMIT');
      await blocked;
      const second = await b.query(
        `UPDATE demo.lab_results SET value = '9.0' WHERE id = $1 AND verified_at IS NULL`,
        [ids.resultWbc],
      );
      expect(second.rowCount).toBe(1);
      await b.query('COMMIT');
      const persisted = await client.query(`SELECT value FROM demo.lab_results WHERE id = $1`, [
        ids.resultWbc,
      ]);
      expect(persisted.rows[0].value).toBe('9.0');
    } finally {
      await a.end();
      await b.end();
    }
  });

  it('rejects duplicate active catalog results when the unique index is applied after a clean audit', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);

    const dupes = await client.query(
      `SELECT request_item_id, parameter_id, count(*) FROM demo.lab_results
       WHERE deleted_at IS NULL AND supersedes_id IS NULL AND parameter_id IS NOT NULL
       GROUP BY 1, 2 HAVING count(*) > 1`,
    );
    expect(dupes.rowCount).toBe(0);

    await client.query(`
      CREATE UNIQUE INDEX idx_lab_results_active_item_parameter
        ON demo.lab_results (request_item_id, parameter_id)
        WHERE deleted_at IS NULL AND supersedes_id IS NULL AND parameter_id IS NOT NULL
    `);

    await expect(
      client.query(
        `INSERT INTO demo.lab_results (request_item_id, parameter_id, value, flag)
         VALUES ($1, $2, '1', 'unassessed')`,
        [ids.itemCatalog, ids.paramWbc],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('rolls back a partial multi-parameter save', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);

    const tx = await connectLabTestClient();
    try {
      await tx.query('BEGIN');
      await tx.query(
        `INSERT INTO demo.lab_results (request_item_id, parameter_id, value, flag)
         VALUES ($1, $2, '12', 'normal')`,
        [ids.itemCatalog, ids.paramHgb],
      );
      await tx.query(`SELECT 1/0`);
      await tx.query('COMMIT');
    } catch {
      await tx.query('ROLLBACK');
    } finally {
      await tx.end();
    }
    const leftover = await client.query(`SELECT 1 FROM demo.lab_results WHERE parameter_id = $1`, [
      ids.paramHgb,
    ]);
    expect(leftover.rowCount).toBe(0);
  });

  it('makes cancel and verify mutually exclusive on the request row', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);

    const a = await connectLabTestClient();
    const b = await connectLabTestClient();
    try {
      await a.query('BEGIN');
      await a.query(`SELECT id FROM demo.lab_requests WHERE id = $1 FOR UPDATE`, [ids.requestCatalog]);
      await a.query(
        `UPDATE demo.lab_requests SET status = 'cancelled', cancelled_reason = 'duplicate'
         WHERE id = $1 AND status NOT IN ('verified','cancelled')`,
        [ids.requestCatalog],
      );

      const verify = b.query(
        `UPDATE demo.lab_requests SET status = 'verified'
         WHERE id = $1 AND status IN ('resulted','processing','sample_collected')`,
        [ids.requestCatalog],
      );
      await a.query('COMMIT');
      const verified = await verify;
      expect(verified.rowCount).toBe(0);
      const status = await client.query(`SELECT status, cancelled_reason FROM demo.lab_requests WHERE id = $1`, [
        ids.requestCatalog,
      ]);
      expect(status.rows[0].status).toBe('cancelled');
      expect(status.rows[0].cancelled_reason).toBe('duplicate');
    } finally {
      await a.end();
      await b.end();
    }
  });

  it('blocks attachment insert after verification and records a rejected specimen reason', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);

    await client.query(`UPDATE demo.lab_requests SET status = 'verified' WHERE id = $1`, [
      ids.requestCatalog,
    ]);
    const open = await client.query(`SELECT status FROM demo.lab_requests WHERE id = $1`, [
      ids.requestCatalog,
    ]);
    expect(open.rows[0].status).toBe('verified');

    await client.query(
      `UPDATE demo.lab_samples
       SET condition = 'haemolysed', rejection_reason = 'Gross haemolysis', received_at = now()
       WHERE id = $1`,
      [ids.sampleCatalog],
    );
    const sample = await client.query(
      `SELECT condition, rejection_reason FROM demo.lab_samples WHERE id = $1`,
      [ids.sampleCatalog],
    );
    expect(sample.rows[0].condition).toBe('haemolysed');
    expect(sample.rows[0].rejection_reason).toBe('Gross haemolysis');
  });

  it('classifies synthetic duplicates without modifying rows', async () => {
    await resetIsolatedLabSchema(client);
    await applyPlannedLabSql(client);
    const ids = await seedSyntheticLabGraph(client);
    await client.query(
      `INSERT INTO demo.lab_results (request_item_id, parameter_id, value, flag)
       VALUES ($1, $2, '99', 'high')`,
      [ids.itemCatalog, ids.paramWbc],
    );
    const before = await client.query(`SELECT count(*)::int AS n FROM demo.lab_results`);
    const sql = loadDuplicateAuditSql();
    expect(sql.toUpperCase()).toContain('READ-ONLY');
    const statements = sql
      .split(';')
      .map((part) =>
        part
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter((part) => /^SELECT\b/i.test(part));
    expect(statements).toHaveLength(3);
    const first = await client.query(statements[0]);
    expect(Number(first.rowCount)).toBeGreaterThan(0);
    expect(first.rows[0].class).toBe('active_catalog_duplicate');
    const after = await client.query(`SELECT count(*)::int AS n FROM demo.lab_results`);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

if (!labPgConfigured()) {
  describe('laboratory PostgreSQL isolation', () => {
    it('is skipped until LAB_TEST_DATABASE_URL points at an isolated database', () => {
      expect(labPgConfigured()).toBe(false);
    });
  });
}
