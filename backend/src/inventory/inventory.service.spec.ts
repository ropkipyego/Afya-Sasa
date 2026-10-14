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
