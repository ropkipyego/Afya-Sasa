import {
  ledgerNetQuantity,
  proposedSellPrice,
  resolveStockImportIntent,
  stockVariance,
  summarizeVariances,
  varianceValue,
} from './stock-integrity';

describe('stock integrity helpers', () => {
  it('does not treat a catalogue import as a stock receipt', () => {
    expect(resolveStockImportIntent({})).toBe('catalogue');
    expect(resolveStockImportIntent({ confirmStockTake: true })).toBe('stock_take');
    expect(resolveStockImportIntent({ importIntent: 'receipt' })).toBe('receipt');
  });

  it('computes signed variance from counted minus system quantity', () => {
    expect(stockVariance(8, 10)).toBe(-2);
    expect(stockVariance(12, 10)).toBe(2);
    expect(varianceValue(-2, 15)).toBe(-30);
  });

  it('keeps gross positive and negative variance visible', () => {
    const summary = summarizeVariances([
      { varianceQty: 4, varianceValue: 40 },
      { varianceQty: -3, varianceValue: -30 },
      { varianceQty: 0, varianceValue: 0 },
      { varianceQty: 1, varianceValue: 10, unresolved: true },
    ]);
    expect(summary.matched).toBe(3);
    expect(summary.unresolved).toBe(1);
    expect(summary.grossPositiveQty).toBe(4);
    expect(summary.grossNegativeQty).toBe(-3);
    expect(summary.netQty).toBe(1);
    expect(summary.netValue).toBe(10);
  });

  it('rebuilds on-hand quantity from signed ledger rows', () => {
    expect(
      ledgerNetQuantity([
        { quantity: '10' },
        { quantity: '-3' },
        { quantity: '1' },
      ]),
    ).toBe(8);
  });

  it('does not use selling price when computing a percent markup from cost', () => {
    const next = proposedSellPrice({
      cost: 100,
      currentSell: 180,
      mode: 'percent_markup',
      value: 20,
    });
    expect(next.proposedSell).toBe(120);
    expect(next.markup).toBe(20);
  });
});
