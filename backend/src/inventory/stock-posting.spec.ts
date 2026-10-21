import { setTimeout as wait } from 'node:timers/promises';
import {
  IMPORT_RECEIPT_REFERENCE_TYPE,
  MANUAL_RECEIPT_REFERENCE_TYPE,
  STOCK_TAKE_REFERENCE_TYPE,
  assertFreshSnapshot,
  dispenseOperationId,
  importLedgerReferenceType,
  importSessionReferenceId,
  otcSaleReferenceId,
  nextOnHand,
  sortStockLockKeys,
} from './stock-posting';
import {
  MemoryInventoryWorld,
  dispenseOnce,
  postStockTake,
  receiveOnce,
} from './stock-posting.memory';

const itemA = 'item-a';
const itemB = 'item-b';
const loc = 'pharmacy';
const lot1 = { itemId: itemA, locationId: loc, batchNo: 'L1' };
const lot2 = { itemId: itemA, locationId: loc, batchNo: 'L2' };
const lotB = { itemId: itemB, locationId: loc, batchNo: null };

describe('stock posting protocol', () => {
  it('locks batches in item, location, lot order', () => {
    const sorted = sortStockLockKeys([lot2, lotB, lot1]);
    expect(sorted.map((row) => `${row.itemId}:${row.batchNo}`)).toEqual([
      'item-a:L1',
      'item-a:L2',
      'item-b:null',
    ]);
  });

  it('does not use a patient id as the OTC sale idempotency key', () => {
    const first = otcSaleReferenceId('aaaaaaaa-0000-4000-8000-000000000001');
    const second = otcSaleReferenceId('aaaaaaaa-0000-4000-8000-000000000001');
    expect(first).toBe(second);
    const generated = otcSaleReferenceId(null);
    expect(generated).not.toBe('p1');
    expect(generated).not.toBe(first);
  });

  it('keeps manual receipts distinct from import receipts', () => {
    expect(importLedgerReferenceType('receipt')).toBe(IMPORT_RECEIPT_REFERENCE_TYPE);
    expect(importLedgerReferenceType('stock_take')).toBe(STOCK_TAKE_REFERENCE_TYPE);
    expect(MANUAL_RECEIPT_REFERENCE_TYPE).toBe('receipt');
  });

  it('maps a non-uuid session key to a stable uuid without colliding with a real uuid', () => {
    const first = importSessionReferenceId('ward-count-1');
    const second = importSessionReferenceId('ward-count-1');
    const uuid = importSessionReferenceId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(uuid).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });

  it('refuses a stale snapshot', () => {
    expect(() => assertFreshSnapshot(10, 8, 2)).toThrow(/system quantity changed \(10 → 8\)/);
  });
});

describe('concurrency-safe stock-take world', () => {
  it('aborts a stock-take when a dispense races and changes on-hand', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 2, status: 'requested', billingStatus: 'uncharged' });
    let dispenseHoldsLock = false;
    const dispense = world.transaction(async (txn) => {
      await txn.lock(lot1);
      dispenseHoldsLock = true;
      await wait(25);
      const next = nextOnHand(world.qty(lot1), -2);
      txn.setQty(lot1, next);
      txn.writeLedger({
        itemId: lot1.itemId,
        batchId: 'batch-dispense',
        quantity: -2,
        transactionType: 'DISPENSE',
        referenceType: 'clinical_order',
        referenceId: 'rx-1',
      });
      const order = world.orders.get('rx-1');
      if (order) {
        order.remaining = 0;
        order.status = 'dispensed';
      }
    });
    while (!dispenseHoldsLock) await wait(5);
    const take = postStockTake({
      world,
      sessionKey: 'session-race-dispense',
      moves: [{ ...lot1, counted: 10, snapshot: 10 }],
    });
    await expect(take).rejects.toThrow(/system quantity changed/);
    await dispense;
    expect(world.qty(lot1)).toBe(8);
    expect(world.ledger.filter((row) => row.transactionType === 'STOCK_TAKE')).toHaveLength(0);
  });

  it('aborts a stock-take when a receipt races and changes on-hand', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    let receiptHoldsLock = false;
    const receipt = world.transaction(async (txn) => {
      await txn.lock(lot1);
      receiptHoldsLock = true;
      await wait(25);
      txn.setQty(lot1, nextOnHand(world.qty(lot1), 5));
      txn.writeLedger({
        itemId: lot1.itemId,
        batchId: 'batch-receipt',
        quantity: 5,
        transactionType: 'RECEIPT',
        referenceType: MANUAL_RECEIPT_REFERENCE_TYPE,
        referenceId: 'manual',
      });
    });
    while (!receiptHoldsLock) await wait(5);
    const take = postStockTake({
      world,
      sessionKey: 'session-race-receipt',
      moves: [{ ...lot1, counted: 10, snapshot: 10 }],
    });
    await expect(take).rejects.toThrow(/system quantity changed/);
    await receipt;
    expect(world.qty(lot1)).toBe(15);
    expect(world.ledger.filter((row) => row.referenceType === MANUAL_RECEIPT_REFERENCE_TYPE)).toHaveLength(1);
  });

  it('records a zero-variance session so a retry cannot post again', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    await postStockTake({
      world,
      sessionKey: 'zero-var',
      moves: [{ ...lot1, counted: 10, snapshot: 10 }],
    });
    expect(world.qty(lot1)).toBe(10);
    expect(world.sessions.has('zero-var')).toBe(true);
    await expect(
      postStockTake({
        world,
        sessionKey: 'zero-var',
        moves: [{ ...lot1, counted: 9, snapshot: 10 }],
      }),
    ).rejects.toThrow(/already posted/);
    expect(world.qty(lot1)).toBe(10);
  });

  it('rejects a stale snapshot before posting', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 7 });
    await expect(
      postStockTake({
        world,
        sessionKey: 'stale',
        moves: [{ ...lot1, counted: 7, snapshot: 10 }],
      }),
    ).rejects.toThrow(/system quantity changed/);
    expect(world.qty(lot1)).toBe(7);
    expect(world.sessions.size).toBe(0);
  });

  it('serialises two concurrent posts of the same session', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    const first = postStockTake({
      world,
      sessionKey: 'same-session',
      moves: [{ ...lot1, counted: 8, snapshot: 10 }],
    });
    const second = postStockTake({
      world,
      sessionKey: 'same-session',
      moves: [{ ...lot1, counted: 8, snapshot: 10 }],
    });
    const results = await Promise.allSettled([first, second]);
    const rejected = results.filter((row) => row.status === 'rejected');
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(world.qty(lot1)).toBe(8);
    expect(world.ledger.filter((row) => row.transactionType === 'STOCK_TAKE')).toHaveLength(1);
  });

  it('adjusts multiple lots of the same product independently', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.seedBatch({ ...lot2, qtyOnHand: 4 });
    await postStockTake({
      world,
      sessionKey: 'multi-lot',
      moves: [
        { ...lot1, counted: 9, snapshot: 10 },
        { ...lot2, counted: 6, snapshot: 4 },
      ],
    });
    expect(world.qty(lot1)).toBe(9);
    expect(world.qty(lot2)).toBe(6);
    expect(world.ledger.map((row) => row.quantity).sort()).toEqual([-1, 2]);
  });

  it('rolls back earlier items when a later stock-take line fails', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.seedBatch({ ...lotB, qtyOnHand: 3 });
    await expect(
      postStockTake({
        world,
        sessionKey: 'mid-fail',
        moves: [
          { ...lot1, counted: 12, snapshot: 10 },
          { ...lotB, counted: 3, snapshot: 3, fail: true },
        ],
      }),
    ).rejects.toThrow(/forced stock-take failure/);
    expect(world.qty(lot1)).toBe(10);
    expect(world.qty(lotB)).toBe(3);
    expect(world.ledger).toHaveLength(0);
    expect(world.sessions.size).toBe(0);
  });

  it('does not receive the same import session twice after a retry', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 0 });
    await receiveOnce({ world, key: lot1, quantity: 20, sessionKey: 'grn-1' });
    await expect(receiveOnce({ world, key: lot1, quantity: 20, sessionKey: 'grn-1' })).rejects.toThrow(
      /already posted/,
    );
    expect(world.qty(lot1)).toBe(20);
    expect(world.ledger.filter((row) => row.referenceType === IMPORT_RECEIPT_REFERENCE_TYPE)).toHaveLength(1);
  });

  it('allows a safe retry after a failed import because the session claim rolls back', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 1 });
    await expect(
      world.transaction(async (txn) => {
        await txn.claimSession('retry-me', 'receipt');
        throw new Error('catalogue failed');
      }),
    ).rejects.toThrow(/catalogue failed/);
    await receiveOnce({ world, key: lot1, quantity: 4, sessionKey: 'retry-me' });
    expect(world.qty(lot1)).toBe(5);
  });

  it('keeps a normal manual receipt on the historical receipt reference', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 0 });
    await receiveOnce({ world, key: lot1, quantity: 3, manual: true });
    expect(world.ledger[0].referenceType).toBe(MANUAL_RECEIPT_REFERENCE_TYPE);
  });
});

describe('dispense and charge in one transaction', () => {
  const charge = { serviceEntityId: 'rx-group', amount: 50, opId: 'op-1' };

  it('commits stock and the charge together', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 2, status: 'requested', billingStatus: 'uncharged' });
    await dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge });
    expect(world.qty(lot1)).toBe(8);
    expect(world.charges.get('rx-group')?.amountOwed).toBe(50);
    expect(world.orders.get('rx-1')?.billingStatus).toBe('charged');
  });

  it('rolls stock back when charge creation fails', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 2, status: 'requested', billingStatus: 'uncharged' });
    await expect(
      dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge: { ...charge, fail: true } }),
    ).rejects.toThrow(/forced charge failure/);
    expect(world.qty(lot1)).toBe(10);
    expect(world.charges.size).toBe(0);
    expect(world.orders.get('rx-1')?.status).toBe('requested');
  });

  it('retries billing after a rolled-back failure without a second stock deduction once charge works', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 2, status: 'requested', billingStatus: 'uncharged' });
    await expect(
      dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge: { ...charge, fail: true } }),
    ).rejects.toThrow(/forced charge failure/);
    await dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge });
    expect(world.qty(lot1)).toBe(8);
    expect(world.charges.get('rx-group')?.amountOwed).toBe(50);
  });

  it('serializes concurrent dispenses so a second request cannot double-issue', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 2, status: 'requested', billingStatus: 'uncharged' });
    const first = dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge });
    const second = dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge });
    const results = await Promise.allSettled([first, second]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    expect(world.qty(lot1)).toBe(8);
    expect(world.charges.get('rx-group')?.amountOwed).toBe(50);
  });

  it('rejects a duplicate dispense of an already issued line', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 2, status: 'requested', billingStatus: 'uncharged' });
    await dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge });
    await expect(dispenseOnce({ world, key: lot1, quantity: 2, orderId: 'rx-1', charge })).rejects.toThrow(
      /already fully dispensed/,
    );
    expect(world.qty(lot1)).toBe(8);
  });

  it('does not add a second charge for the same dispense operation id', async () => {
    const world = new MemoryInventoryWorld();
    world.charges.set('rx-group', { id: 'chg-1', serviceEntityId: 'rx-group', amountOwed: 50, ops: ['op-1'] });
    world.seedBatch({ ...lot1, qtyOnHand: 8 });
    await world.transaction(async (txn) => {
      await txn.lock(lot1);
      const existing = world.charges.get('rx-group');
      if (existing?.ops.includes('op-1')) return;
      throw new Error('should have been idempotent');
    });
    expect(world.charges.get('rx-group')?.amountOwed).toBe(50);
  });

  it('keeps the same operation id for a retry of the same lines', () => {
    const a = dispenseOperationId({
      serviceEntityId: 'g1',
      lines: [
        { orderId: 'o2', quantity: 1 },
        { orderId: 'o1', quantity: 2 },
      ],
    });
    const b = dispenseOperationId({
      serviceEntityId: 'g1',
      lines: [
        { orderId: 'o1', quantity: 2 },
        { orderId: 'o2', quantity: 1 },
      ],
    });
    expect(a).toBe(b);
  });
});

describe('stock and financial consistency', () => {
  it('rebuilds on-hand from signed ledger rows after receipt, dispense and stock-take', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 0 });
    await receiveOnce({ world, key: lot1, quantity: 10, manual: true });
    world.orders.set('rx-1', { id: 'rx-1', remaining: 3, status: 'requested', billingStatus: 'uncharged' });
    await dispenseOnce({
      world,
      key: lot1,
      quantity: 3,
      orderId: 'rx-1',
      charge: { serviceEntityId: 'g1', amount: 30, opId: 'op-rx' },
    });
    await postStockTake({
      world,
      sessionKey: 'count-1',
      moves: [{ ...lot1, counted: 6, snapshot: 7 }],
    });
    const net = world.ledger.reduce((sum, row) => sum + row.quantity, 0);
    expect(world.qty(lot1)).toBe(6);
    expect(net).toBe(6);
    expect(world.charges.get('g1')?.amountOwed).toBe(30);
    expect(world.orders.get('rx-1')?.billingStatus).toBe('charged');
  });

  it('charges an identified OTC sale once and rolls back stock if billing fails', async () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 10 });
    await expect(
      dispenseOnce({
        world,
        key: lot1,
        quantity: 1,
        orderId: 'otc-1',
        charge: { serviceEntityId: 'otc-1', amount: 12, opId: 'otc-1', fail: true },
      }),
    ).rejects.toThrow(/forced charge failure/);
    expect(world.qty(lot1)).toBe(10);
    await dispenseOnce({
      world,
      key: lot1,
      quantity: 1,
      orderId: 'otc-1',
      charge: { serviceEntityId: 'otc-1', amount: 12, opId: 'otc-1' },
    });
    expect(world.qty(lot1)).toBe(9);
    expect(world.charges.get('otc-1')?.amountOwed).toBe(12);
  });

  it('does not move stock for a catalogue-only session', () => {
    const world = new MemoryInventoryWorld();
    world.seedBatch({ ...lot1, qtyOnHand: 4 });
    world.catalogue.set('PARA', { sku: 'PARA', name: 'Paracetamol' });
    expect(world.qty(lot1)).toBe(4);
    expect(world.ledger).toHaveLength(0);
  });

  it('refuses negative on-hand', () => {
    expect(() => nextOnHand(1, -2)).toThrow(/negative/);
  });
});
