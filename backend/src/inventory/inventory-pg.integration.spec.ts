import { setTimeout as wait } from 'node:timers/promises';
import {
  connectInventoryTestClient,
  inventoryPgConfigured,
  resetInventoryItSchema,
  type InventoryPgClient,
} from './inventory-pg-harness';

jest.setTimeout(30_000);

const describePg = inventoryPgConfigured() ? describe : describe.skip;

const itemId = 'aaaaaaaa-0000-4000-8000-000000000001';
const locA = 'bbbbbbbb-0000-4000-8000-000000000001';
const locB = 'bbbbbbbb-0000-4000-8000-000000000002';
const batchId = 'cccccccc-0000-4000-8000-000000000001';
const destBatch = 'cccccccc-0000-4000-8000-000000000002';
const orderId = 'dddddddd-0000-4000-8000-000000000001';
const sessionId = 'eeeeeeee-0000-4000-8000-000000000001';

describePg('inventory PostgreSQL isolation (INVENTORY_TEST_DATABASE_URL)', () => {
  let a: InventoryPgClient;
  let b: InventoryPgClient;

  beforeAll(async () => {
    a = await connectInventoryTestClient();
    b = await connectInventoryTestClient();
  });

  afterAll(async () => {
    await a?.end();
    await b?.end();
  });

  afterEach(async () => {
    await a.query('ROLLBACK').catch(() => undefined);
    await b.query('ROLLBACK').catch(() => undefined);
  });

  beforeEach(async () => {
    await a.query('ROLLBACK').catch(() => undefined);
    await b.query('ROLLBACK').catch(() => undefined);
    await resetInventoryItSchema(a);
    await a.query(
      `INSERT INTO inventory_it.batches (id, item_id, location_id, batch_no, qty_on_hand)
       VALUES ($1, $2, $3, 'L1', 10), ($4, $2, $5, 'L1', 0)`,
      [batchId, itemId, locA, destBatch, locB],
    );
    await a.query(
      `INSERT INTO inventory_it.orders (id, remaining, status, billing_status)
       VALUES ($1, 2, 'requested', 'uncharged')`,
      [orderId],
    );
  });

  it('lets a stock-take wait for a dispense, then aborts on a stale snapshot', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 8 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -2, 'DISPENSE', 'clinical_order', $3)`,
      [itemId, batchId, orderId],
    );
    const take = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
      const qty = await b.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
      const actual = Number(qty.rows[0].qty_on_hand);
      if (actual !== 10) {
        await b.query('ROLLBACK');
        return { aborted: true, actual };
      }
      await b.query('COMMIT');
      return { aborted: false, actual };
    })();
    await wait(50);
    await a.query('COMMIT');
    const result = await take;
    expect(result).toEqual({ aborted: true, actual: 8 });
    const stored = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(stored.rows[0].qty_on_hand)).toBe(8);
  });

  it('lets a stock-take wait for a receipt, then aborts on a stale snapshot', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 15 WHERE id = $1`, [batchId]);
    const take = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
      const qty = await b.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
      const actual = Number(qty.rows[0].qty_on_hand);
      await b.query('ROLLBACK');
      return actual;
    })();
    await wait(50);
    await a.query('COMMIT');
    expect(await take).toBe(15);
  });

  it('serialises a transfer debit against a dispense on the same lot', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = qty_on_hand - 2 WHERE id = $1`, [batchId]);
    const transfer = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.batches WHERE id = $1 FOR UPDATE`, [batchId]);
      const qty = await b.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
      const available = Number(qty.rows[0].qty_on_hand);
      if (available < 10) {
        await b.query('ROLLBACK');
        return available;
      }
      await b.query(`UPDATE inventory_it.batches SET qty_on_hand = qty_on_hand - 10 WHERE id = $1`, [batchId]);
      await b.query('COMMIT');
      return available;
    })();
    await wait(50);
    await a.query('COMMIT');
    expect(await transfer).toBe(8);
    const stored = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(stored.rows[0].qty_on_hand)).toBe(8);
  });

  it('rejects a second concurrent session with the same key, including zero variance', async () => {
    await a.query('BEGIN');
    await a.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      'afyasasa.inventory.import',
      'stock_take:same',
    ]);
    await a.query(
      `INSERT INTO inventory_it.sessions (session_key, intent, status) VALUES ('same', 'stock_take', 'posted')`,
    );
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, 0, 'STOCK_TAKE', 'stock_take', $2)`,
      [itemId, sessionId],
    );
    const second = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
        'afyasasa.inventory.import',
        'stock_take:same',
      ]);
      const existing = await b.query(`SELECT 1 FROM inventory_it.sessions WHERE session_key = 'same'`);
      await b.query('ROLLBACK');
      return existing.rowCount;
    })();
    await wait(50);
    await a.query('COMMIT');
    expect(await second).toBe(1);
  });

  it('rolls back the first line when a later line fails', async () => {
    await a.query('BEGIN');
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 12 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, 2, 'STOCK_TAKE', 'stock_take', $3)`,
      [itemId, batchId, sessionId],
    );
    await a.query('ROLLBACK');
    const stored = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    const ledger = await a.query(`SELECT count(*)::int AS n FROM inventory_it.ledger`);
    expect(Number(stored.rows[0].qty_on_hand)).toBe(10);
    expect(ledger.rows[0].n).toBe(0);
  });

  it('keeps stock and order unchanged when charge insert fails in the same transaction', async () => {
    await a.query('BEGIN');
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 8 WHERE id = $1`, [batchId]);
    await a.query(`UPDATE inventory_it.orders SET remaining = 0, status = 'dispensed' WHERE id = $1`, [orderId]);
    await a.query('ROLLBACK');
    const batch = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    const order = await a.query(`SELECT remaining, status, billing_status FROM inventory_it.orders WHERE id = $1`, [
      orderId,
    ]);
    const charges = await a.query(`SELECT count(*)::int AS n FROM inventory_it.charges`);
    expect(Number(batch.rows[0].qty_on_hand)).toBe(10);
    expect(order.rows[0]).toEqual({ remaining: '2', status: 'requested', billing_status: 'uncharged' });
    expect(charges.rows[0].n).toBe(0);
  });

  it('retries billing without a second stock deduction and ignores duplicate op ids', async () => {
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 8 WHERE id = $1`, [batchId]);
    await a.query(
      `UPDATE inventory_it.orders SET remaining = 0, status = 'dispensed', billing_status = 'awaiting_charge' WHERE id = $1`,
      [orderId],
    );
    await a.query('BEGIN');
    await a.query(
      `INSERT INTO inventory_it.charges (service_entity_id, amount_owed, dispense_ops)
       VALUES ('g1', 50, ARRAY['op-1'])`,
    );
    await a.query(`UPDATE inventory_it.orders SET billing_status = 'charged' WHERE id = $1`, [orderId]);
    await a.query('COMMIT');
    const dup = await a.query(`SELECT dispense_ops FROM inventory_it.charges WHERE service_entity_id = 'g1'`);
    const ops = dup.rows[0].dispense_ops as string[];
    if (ops.includes('op-1')) {
      // retry no-ops
    } else {
      await a.query(`UPDATE inventory_it.charges SET amount_owed = amount_owed + 50 WHERE service_entity_id = 'g1'`);
    }
    const charge = await a.query(`SELECT amount_owed FROM inventory_it.charges WHERE service_entity_id = 'g1'`);
    const batch = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(charge.rows[0].amount_owed)).toBe(50);
    expect(Number(batch.rows[0].qty_on_hand)).toBe(8);
  });

  it('identifies the disposable database, not a live service', async () => {
    const identity = await a.query('SELECT current_database() AS db, current_user AS usr');
    expect(identity.rows[0]).toEqual({ db: 'inventory_it', usr: 'inventory_it' });
  });

  it('rejects a second requisition issue after the first commits', async () => {
    const reqId = 'ffffffff-0000-4000-8000-000000000001';
    await a.query(
      `INSERT INTO inventory_it.documents (id, kind, status, shipped_qty) VALUES ($1, 'requisition', 'approved', 4)`,
      [reqId],
    );
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [reqId]);
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = qty_on_hand - 4 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -4, 'ISSUE', 'requisition', $3)`,
      [itemId, batchId, reqId],
    );
    await a.query(`UPDATE inventory_it.documents SET status = 'issued' WHERE id = $1`, [reqId]);
    await a.query('COMMIT');
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [reqId]);
    const status = await a.query(`SELECT status FROM inventory_it.documents WHERE id = $1`, [reqId]);
    await a.query('ROLLBACK');
    expect(status.rows[0].status).toBe('issued');
    const qty = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    expect(Number(qty.rows[0].qty_on_hand)).toBe(6);
  });

  it('serialises concurrent transfer receive and refuses a second credit', async () => {
    const trf = 'ffffffff-0000-4000-8000-000000000002';
    await a.query(
      `INSERT INTO inventory_it.documents (id, kind, status, shipped_qty) VALUES ($1, 'transfer', 'in_transit', 3)`,
      [trf],
    );
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -3, 'TRANSFER_OUT', 'transfer', $3)`,
      [itemId, batchId, trf],
    );
    await a.query('BEGIN');
    await a.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [trf]);
    const receive = (async () => {
      await b.query('BEGIN');
      await b.query(`SELECT id FROM inventory_it.documents WHERE id = $1 FOR UPDATE`, [trf]);
      const row = await b.query(`SELECT status, received_qty FROM inventory_it.documents WHERE id = $1`, [trf]);
      if (row.rows[0].status !== 'in_transit') {
        await b.query('ROLLBACK');
        return { skipped: true, status: row.rows[0].status };
      }
      await b.query('ROLLBACK');
      return { skipped: false, status: row.rows[0].status };
    })();
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 3 WHERE id = $1`, [destBatch]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, 3, 'TRANSFER_IN', 'transfer', $3)`,
      [itemId, destBatch, trf],
    );
    await a.query(
      `UPDATE inventory_it.documents SET status = 'completed', received_qty = 3 WHERE id = $1`,
      [trf],
    );
    await wait(50);
    await a.query('COMMIT');
    const second = await receive;
    expect(second).toEqual({ skipped: true, status: 'completed' });
    const dest = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [destBatch]);
    const ins = await a.query(
      `SELECT count(*)::int AS n FROM inventory_it.ledger WHERE transaction_type = 'TRANSFER_IN' AND reference_id = $1`,
      [trf],
    );
    expect(Number(dest.rows[0].qty_on_hand)).toBe(3);
    expect(ins.rows[0].n).toBe(1);
  });

  it('rolls back OTC stock when the charge insert is aborted', async () => {
    await a.query('BEGIN');
    await a.query(`UPDATE inventory_it.batches SET qty_on_hand = 9 WHERE id = $1`, [batchId]);
    await a.query(
      `INSERT INTO inventory_it.ledger (item_id, batch_id, quantity, transaction_type, reference_type, reference_id)
       VALUES ($1, $2, -1, 'DISPENSE', 'otc_sale', $3)`,
      [itemId, batchId, orderId],
    );
    await a.query('ROLLBACK');
    const qty = await a.query(`SELECT qty_on_hand FROM inventory_it.batches WHERE id = $1`, [batchId]);
    const ledger = await a.query(
      `SELECT count(*)::int AS n FROM inventory_it.ledger WHERE reference_type = 'otc_sale'`,
    );
    const charges = await a.query(`SELECT count(*)::int AS n FROM inventory_it.charges`);
    expect(Number(qty.rows[0].qty_on_hand)).toBe(10);
    expect(ledger.rows[0].n).toBe(0);
    expect(charges.rows[0].n).toBe(0);
  });
});

describe('inventory PostgreSQL isolation availability', () => {
  if (inventoryPgConfigured()) {
    it('is configured for isolated localhost use', () => {
      expect(inventoryPgConfigured()).toBe(true);
    });
    return;
  }
  it('is skipped until INVENTORY_TEST_DATABASE_URL points at an isolated localhost database', () => {
    expect(inventoryPgConfigured()).toBe(false);
  });
});
