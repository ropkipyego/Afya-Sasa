import {
  assertFreshSnapshot,
  duplicateImportSessionMessage,
  importLedgerReferenceType,
  importSessionReferenceId,
  nextOnHand,
  signedStockTakeVariance,
  sortStockLockKeys,
  stockLockKey,
  type StockLockKey,
} from './stock-posting';

type BatchRow = {
  id: string;
  itemId: string;
  locationId: string;
  batchNo: string | null;
  qtyOnHand: number;
};

type LedgerRow = {
  itemId: string;
  batchId: string;
  quantity: number;
  transactionType: 'RECEIPT' | 'DISPENSE' | 'STOCK_TAKE';
  referenceType: string;
  referenceId: string | null;
};

type SessionRow = { key: string; intent: 'receipt' | 'stock_take'; status: 'posted' };
type ChargeRow = { id: string; serviceEntityId: string; amountOwed: number; ops: string[] };
type OrderRow = {
  id: string;
  remaining: number;
  status: string;
  billingStatus: 'uncharged' | 'charged' | 'awaiting_charge';
};

class Mutex {
  private tail = Promise.resolve();

  acquire() {
    let release!: () => void;
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    const wait = this.tail.then(() => release);
    this.tail = this.tail.then(() => done);
    return wait;
  }
}

export class MemoryInventoryWorld {
  batches = new Map<string, BatchRow>();
  ledger: LedgerRow[] = [];
  sessions = new Map<string, SessionRow>();
  charges = new Map<string, ChargeRow>();
  orders = new Map<string, OrderRow>();
  catalogue = new Map<string, { sku: string; name: string }>();
  private mutexes = new Map<string, Mutex>();
  private seq = 1;

  seedBatch(row: Omit<BatchRow, 'id'> & { id?: string }) {
    const id = row.id ?? `batch-${this.seq++}`;
    const next = { ...row, id };
    this.batches.set(stockLockKey(next), next);
    return next;
  }

  async transaction<T>(fn: (txn: MemoryInventoryTxn) => Promise<T>): Promise<T> {
    const txn = new MemoryInventoryTxn(this);
    try {
      const result = await fn(txn);
      txn.commit();
      return result;
    } catch (error) {
      txn.rollback();
      throw error;
    }
  }

  mutex(name: string) {
    const existing = this.mutexes.get(name);
    if (existing) return existing;
    const created = new Mutex();
    this.mutexes.set(name, created);
    return created;
  }

  qty(key: StockLockKey) {
    return this.batches.get(stockLockKey(key))?.qtyOnHand ?? 0;
  }
}

export class MemoryInventoryTxn {
  private held: Array<() => void> = [];
  private originals = new Map<string, BatchRow | undefined>();
  private ledgerRows: LedgerRow[] = [];
  private addedSessions: string[] = [];
  private chargeOriginals = new Map<string, ChargeRow | undefined>();
  private orderOriginals = new Map<string, OrderRow | undefined>();
  private catalogueOriginals = new Map<string, { sku: string; name: string } | undefined>();
  private committed = false;

  constructor(private readonly world: MemoryInventoryWorld) {}

  async lock(key: StockLockKey) {
    const release = await this.world.mutex(`batch:${stockLockKey(key)}`).acquire();
    this.held.push(release);
    const lockId = stockLockKey(key);
    if (!this.originals.has(lockId)) {
      const current = this.world.batches.get(lockId);
      this.originals.set(lockId, current ? { ...current } : undefined);
    }
    return this.world.batches.get(lockId) ?? null;
  }

  async lockMany(keys: StockLockKey[]) {
    const locked: BatchRow[] = [];
    for (const key of sortStockLockKeys(keys)) {
      const row = await this.lock(key);
      if (row) locked.push(row);
    }
    return locked;
  }

  async claimSession(sessionKey: string, intent: 'receipt' | 'stock_take') {
    const release = await this.world.mutex(`session:${sessionKey}`).acquire();
    this.held.push(release);
    if (this.world.sessions.has(sessionKey)) {
      throw new Error(duplicateImportSessionMessage());
    }
    this.addedSessions.push(sessionKey);
    this.world.sessions.set(sessionKey, { key: sessionKey, intent, status: 'posted' });
    return importSessionReferenceId(sessionKey);
  }

  setQty(key: StockLockKey, qty: number, itemId = key.itemId) {
    const id = stockLockKey(key);
    const existing = this.world.batches.get(id);
    if (existing) {
      existing.qtyOnHand = qty;
      return existing;
    }
    const created: BatchRow = {
      id: `batch-${id}`,
      itemId,
      locationId: key.locationId,
      batchNo: key.batchNo,
      qtyOnHand: qty,
    };
    this.world.batches.set(id, created);
    return created;
  }

  writeLedger(row: LedgerRow) {
    this.world.ledger.push(row);
    this.ledgerRows.push(row);
  }

  touchCharge(id: string) {
    if (!this.chargeOriginals.has(id)) {
      const current = this.world.charges.get(id);
      this.chargeOriginals.set(id, current ? { ...current, ops: [...current.ops] } : undefined);
    }
  }

  touchOrder(id: string) {
    if (!this.orderOriginals.has(id)) {
      const current = this.world.orders.get(id);
      this.orderOriginals.set(id, current ? { ...current } : undefined);
    }
  }

  commit() {
    this.committed = true;
    this.release();
  }

  rollback() {
    if (this.committed) return;
    for (const [id, original] of this.originals) {
      if (original) this.world.batches.set(id, { ...original });
      else this.world.batches.delete(id);
    }
    this.world.ledger = this.world.ledger.filter((row) => !this.ledgerRows.includes(row));
    for (const key of this.addedSessions) this.world.sessions.delete(key);
    for (const [id, original] of this.chargeOriginals) {
      if (original) this.world.charges.set(id, { ...original, ops: [...original.ops] });
      else this.world.charges.delete(id);
    }
    for (const [id, original] of this.orderOriginals) {
      if (original) this.world.orders.set(id, { ...original });
      else this.world.orders.delete(id);
    }
    for (const [id, original] of this.catalogueOriginals) {
      if (original) this.world.catalogue.set(id, { ...original });
      else this.world.catalogue.delete(id);
    }
    this.release();
  }

  private release() {
    for (const unlock of this.held.splice(0).reverse()) unlock();
  }
}


export async function postStockTake(input: {
  world: MemoryInventoryWorld;
  sessionKey: string;
  moves: Array<StockLockKey & { counted: number; snapshot?: number; fail?: boolean }>;
}) {
  return input.world.transaction(async (txn) => {
    const sessionId = await txn.claimSession(input.sessionKey, 'stock_take');
    await txn.lockMany(input.moves);
    for (const move of input.moves) {
      if (move.fail) throw new Error('forced stock-take failure');
      const systemQty = input.world.qty(move);
      assertFreshSnapshot(move.snapshot, systemQty);
      const variance = signedStockTakeVariance(move.counted, systemQty);
      if (variance === 0) continue;
      const next = nextOnHand(systemQty, variance);
      const batch = txn.setQty(move, next, move.itemId);
      txn.writeLedger({
        itemId: move.itemId,
        batchId: batch.id,
        quantity: variance,
        transactionType: 'STOCK_TAKE',
        referenceType: importLedgerReferenceType('stock_take'),
        referenceId: sessionId,
      });
    }
  });
}

export async function receiveOnce(input: {
  world: MemoryInventoryWorld;
  key: StockLockKey;
  quantity: number;
  sessionKey?: string;
  manual?: boolean;
}) {
  return input.world.transaction(async (txn) => {
    const sessionId = input.sessionKey ? await txn.claimSession(input.sessionKey, 'receipt') : null;
    await txn.lock(input.key);
    const next = nextOnHand(input.world.qty(input.key), input.quantity);
    const batch = txn.setQty(input.key, next);
    txn.writeLedger({
      itemId: input.key.itemId,
      batchId: batch.id,
      quantity: input.quantity,
      transactionType: 'RECEIPT',
      referenceType: input.manual ? 'receipt' : importLedgerReferenceType('receipt'),
      referenceId: sessionId ?? batch.id,
    });
    return batch;
  });
}

export async function dispenseOnce(input: {
  world: MemoryInventoryWorld;
  key: StockLockKey;
  quantity: number;
  orderId: string;
  charge?: { serviceEntityId: string; amount: number; fail?: boolean; opId: string };
}) {
  return input.world.transaction(async (txn) => {
    await txn.lock(input.key);
    const order = input.world.orders.get(input.orderId);
    if (order) {
      txn.touchOrder(order.id);
      if (order.remaining <= 0 || order.status === 'dispensed') {
        throw new Error('This prescription line is already fully dispensed.');
      }
      order.remaining -= input.quantity;
      order.status = order.remaining <= 0 ? 'dispensed' : 'partially_dispensed';
    }
    const next = nextOnHand(input.world.qty(input.key), -input.quantity);
    const batch = txn.setQty(input.key, next);
    txn.writeLedger({
      itemId: input.key.itemId,
      batchId: batch.id,
      quantity: -input.quantity,
      transactionType: 'DISPENSE',
      referenceType: 'clinical_order',
      referenceId: input.orderId,
    });
    if (input.charge) {
      txn.touchCharge(input.charge.serviceEntityId);
      if (input.charge.fail) throw new Error('forced charge failure');
      const existing = input.world.charges.get(input.charge.serviceEntityId);
      if (existing?.ops.includes(input.charge.opId)) return;
      if (existing) {
        existing.amountOwed += input.charge.amount;
        existing.ops.push(input.charge.opId);
      } else {
        input.world.charges.set(input.charge.serviceEntityId, {
          id: `chg-${input.charge.serviceEntityId}`,
          serviceEntityId: input.charge.serviceEntityId,
          amountOwed: input.charge.amount,
          ops: [input.charge.opId],
        });
      }
      if (order) order.billingStatus = 'charged';
    }
  });
}
