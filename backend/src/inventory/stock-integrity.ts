export type StockImportIntent = 'catalogue' | 'receipt' | 'stock_take';

export function resolveStockImportIntent(input: {
  importIntent?: string | null;
  confirmStockTake?: boolean | null;
}): StockImportIntent {
  const raw = (input.importIntent ?? '').trim().toLowerCase();
  if (raw === 'catalogue' || raw === 'receipt' || raw === 'stock_take') return raw;
  if (input.confirmStockTake) return 'stock_take';
  return 'catalogue';
}

/** Counted minus system. Positive = surplus on shelf; negative = shortage. */
export function stockVariance(counted: number, systemQty: number) {
  return roundQty(counted - systemQty);
}

export function varianceValue(varianceQty: number, unitCost: number) {
  const cost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
  return roundMoney(varianceQty * cost);
}

export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function ledgerNetQuantity(
  rows: Array<{ quantity: string | number }>,
) {
  return roundQty(rows.reduce((sum, row) => sum + Number(row.quantity), 0));
}

export function summarizeVariances(
  rows: Array<{ varianceQty: number; varianceValue: number; unresolved?: boolean }>,
) {
  const matched = rows.filter((row) => !row.unresolved);
  const positives = matched.filter((row) => row.varianceQty > 0);
  const negatives = matched.filter((row) => row.varianceQty < 0);
  const unchanged = matched.filter((row) => row.varianceQty === 0);
  return {
    itemsCounted: rows.length,
    matched: matched.length,
    unresolved: rows.filter((row) => row.unresolved).length,
    positiveAdjustments: positives.length,
    negativeAdjustments: negatives.length,
    unchanged: unchanged.length,
    grossPositiveQty: roundQty(positives.reduce((sum, row) => sum + row.varianceQty, 0)),
    grossNegativeQty: roundQty(negatives.reduce((sum, row) => sum + row.varianceQty, 0)),
    netQty: roundQty(matched.reduce((sum, row) => sum + row.varianceQty, 0)),
    grossPositiveValue: roundMoney(positives.reduce((sum, row) => sum + row.varianceValue, 0)),
    grossNegativeValue: roundMoney(negatives.reduce((sum, row) => sum + row.varianceValue, 0)),
    netValue: roundMoney(matched.reduce((sum, row) => sum + row.varianceValue, 0)),
  };
}

export function proposedSellPrice(input: {
  cost: number;
  currentSell: number;
  mode: 'percent_markup' | 'add_amount' | 'set_sell';
  value: number;
}) {
  const cost = Number.isFinite(input.cost) ? Math.max(0, input.cost) : 0;
  const current = Number.isFinite(input.currentSell) ? Math.max(0, input.currentSell) : 0;
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    throw new Error('Adjustment value is not a number.');
  }
  let sell = current;
  if (input.mode === 'percent_markup') {
    const base = cost > 0 ? cost : current;
    sell = base * (1 + value / 100);
  } else if (input.mode === 'add_amount') {
    sell = current + value;
  } else {
    sell = value;
  }
  if (sell < 0) throw new Error('Selling price cannot be negative.');
  const markup = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
  return {
    cost: roundMoney(cost),
    currentSell: roundMoney(current),
    proposedSell: roundMoney(sell),
    markup: roundMoney(markup),
    margin: roundMoney(margin),
  };
}

export function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
