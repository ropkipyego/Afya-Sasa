import {
  InventoryService,
  aliasInventoryHeader,
  isExpiredBatch,
  parseInventoryCsv,
  skuFromName,
} from './inventory.service';

describe('isExpiredBatch', () => {
  const now = new Date('2026-09-23T10:00:00.000Z');

  it('treats missing expiry as usable', () => {
    expect(isExpiredBatch(null, now)).toBe(false);
    expect(isExpiredBatch(undefined, now)).toBe(false);
  });

  it('keeps stock usable on the expiry date', () => {
    expect(isExpiredBatch('2026-09-23', now)).toBe(false);
  });

  it('rejects lots that expired yesterday', () => {
    expect(isExpiredBatch('2026-09-22', now)).toBe(true);
  });
});

describe('import session contract', () => {
  it('refuses to post stock without a session id', async () => {
    const instance = Object.create(InventoryService.prototype) as InventoryService;
    await expect(
      instance.importCatalog(
        {
          csv: 'name,counted_qty\nParacetamol,10',
          importIntent: 'stock_take',
          confirmStockTake: true,
        } as never,
        { user: { sub: 'u1' } } as never,
      ),
    ).rejects.toThrow(/sessionId is required/);
  });
});

describe('pharmacy dispense confirmation', () => {
  it('does not deduct stock until confirm is true', async () => {
    const instance = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(instance, { items: { manager: { transaction: jest.fn() } } });
    await expect(
      instance.dispensePrescription(
        { confirm: false, lines: [{ clinicalOrderId: 'o1' }] } as never,
        { user: { sub: 'pharm-1' } } as never,
      ),
    ).rejects.toThrow(/Confirm dispensing/);
    expect(
      (instance as unknown as { items: { manager: { transaction: jest.Mock } } }).items.manager
        .transaction,
    ).not.toHaveBeenCalled();
  });
});

describe('pharmacy catalogue product matching', () => {
  const para = {
    id: 'item-para',
    name: 'Paracetamol 500mg',
    sku: 'PARA500',
    category: 'pharmaceutical',
    active: true,
  };
  const ibuprofen = {
    id: 'item-ibu',
    name: 'Ibuprofen 400mg',
    sku: 'IBU400',
    category: 'pharmaceutical',
    active: true,
  };
  const gauze = {
    id: 'item-gauze',
    name: 'Gauze',
    sku: 'GAUZE',
    category: 'medical_consumable',
    active: true,
  };

  const resolve = (
    InventoryService.prototype as unknown as {
      resolvePharmacyItem: (
        items: { findOne: jest.Mock; find: jest.Mock },
        order: { metadata?: Record<string, unknown> },
        itemId?: string,
      ) => Promise<{ id: string }>;
    }
  ).resolvePharmacyItem;

  function itemsRepo(rows: Array<{ id: string; category: string; active: boolean }>) {
    return {
      findOne: jest.fn(async ({ where }: { where: { id: string; active?: boolean } }) =>
        rows.find((row) => row.id === where.id && row.active !== false) ?? null,
      ),
      find: jest.fn(),
    };
  }

  it('rejects a missing catalogue product id and does not search by name', async () => {
    const items = itemsRepo([para]);
    await expect(
      resolve.call(
        Object.create(InventoryService.prototype),
        items,
        { metadata: { medication: 'Paracetamol 500mg', itemId: null } },
        undefined,
      ),
    ).rejects.toThrow(/exact catalogue product/);
    expect(items.find).not.toHaveBeenCalled();
    expect(items.findOne).not.toHaveBeenCalled();
  });

  it('rejects an invalid catalogue product id', async () => {
    const items = itemsRepo([para]);
    await expect(
      resolve.call(
        Object.create(InventoryService.prototype),
        items,
        { metadata: { medication: 'Paracetamol 500mg', itemId: para.id } },
        'not-a-real-item',
      ),
    ).rejects.toThrow(/not found or is inactive/);
    expect(items.find).not.toHaveBeenCalled();
  });

  it('rejects a product that does not match the prescribed catalogue id', async () => {
    const items = itemsRepo([para, ibuprofen]);
    await expect(
      resolve.call(
        Object.create(InventoryService.prototype),
        items,
        { metadata: { medication: para.name, itemId: para.id } },
        ibuprofen.id,
      ),
    ).rejects.toThrow(/does not match the prescribed catalogue product/);
    expect(items.find).not.toHaveBeenCalled();
  });

  it('issues the prescribed product when the request id matches exactly', async () => {
    const items = itemsRepo([para, ibuprofen]);
    await expect(
      resolve.call(
        Object.create(InventoryService.prototype),
        items,
        { metadata: { medication: para.name, itemId: para.id } },
        para.id,
      ),
    ).resolves.toMatchObject({ id: para.id, sku: para.sku });
    expect(items.find).not.toHaveBeenCalled();
  });

  it('accepts an explicit catalogue id on a legacy line that has no prescribed product id', async () => {
    const items = itemsRepo([para]);
    await expect(
      resolve.call(
        Object.create(InventoryService.prototype),
        items,
        { metadata: { medication: 'Paracetamol 500mg' } },
        para.id,
      ),
    ).resolves.toMatchObject({ id: para.id });
    expect(items.find).not.toHaveBeenCalled();
  });

  it('skips expired lots and refuses when only expired stock remains', async () => {
    const allocate = (
      InventoryService.prototype as unknown as {
        allocateFromBatches: (
          batches: Array<{ expiryDate?: string | null; qtyOnHand: string }>,
          quantity: number,
          message?: string,
        ) => Array<{ quantity: number }>;
      }
    ).allocateFromBatches;
    const now = new Date('2026-10-20T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    try {
      expect(() =>
        allocate.call(
          Object.create(InventoryService.prototype),
          [{ expiryDate: '2026-10-01', qtyOnHand: '20' }],
          5,
          'Insufficient usable (non-expired) pharmacy stock',
        ),
      ).toThrow(/Insufficient usable/);
      const allocations = allocate.call(
        Object.create(InventoryService.prototype),
        [
          { id: 'later', expiryDate: '2027-01-01', qtyOnHand: '4' },
          { id: 'sooner', expiryDate: '2026-12-01', qtyOnHand: '4' },
        ],
        3,
      );
      expect(allocations).toMatchObject([{ quantity: 3, batch: { id: 'sooner' } }]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a non-pharmaceutical catalogue id', async () => {
    const items = itemsRepo([gauze]);
    await expect(
      resolve.call(
        Object.create(InventoryService.prototype),
        items,
        { metadata: { itemId: gauze.id } },
        gauze.id,
      ),
    ).rejects.toThrow(/pharmaceutical/);
  });
});

describe('stock-take import policy', () => {
  it('maps counted and system quantity columns separately', () => {
    const rows = parseInventoryCsv(
      'item_id,sku,name,system_qty,counted_qty\nid-1,PARA,Paracetamol,10,8',
    );
    expect(rows[0].system_qty).toBe('10');
    expect(rows[0].counted_qty).toBe('8');
    expect(rows[0].opening_qty).toBeUndefined();
  });
});

describe('hospital stock-take import mapping', () => {
  it('aliases Jalaram sheet headers', () => {
    expect(aliasInventoryHeader('NAME OF THE ITEM')).toBe('name');
    expect(aliasInventoryHeader('QTY')).toBe('opening_qty');
    expect(aliasInventoryHeader('RATE')).toBe('sell');
    expect(aliasInventoryHeader('BATCH NO.')).toBe('batch_no');
    expect(aliasInventoryHeader('EXPIRY')).toBe('expiry');
  });

  it('reads a physical stock sheet without a SKU column', () => {
    const rows = parseInventoryCsv(
      'NAME OF THE ITEM,QTY,RATE,AMOUNT,BATCH NO.,EXPIRY\nParacetamol 500mg tablet,100,3,300,BTH-001,2027-12-31',
    );
    expect(rows[0]).toMatchObject({
      name: 'Paracetamol 500mg tablet',
      opening_qty: '100',
      sell: '3',
      batch_no: 'BTH-001',
      expiry: '2027-12-31',
    });
    expect(skuFromName(rows[0].name)).toBe('PARACETAMOL500MGTA');
  });
});
