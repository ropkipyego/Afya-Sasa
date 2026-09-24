export type LabTestPrice = { sell: number };

export function readLabTestPricing(catalog?: Record<string, unknown> | null): Record<string, LabTestPrice> {
  const raw = catalog?.labTestPricing;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, LabTestPrice> = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const sell =
      typeof value === 'number'
        ? value
        : value && typeof value === 'object' && 'sell' in value
          ? Number((value as LabTestPrice).sell)
          : Number.NaN;
    if (Number.isFinite(sell) && sell >= 0) {
      out[code.toUpperCase()] = { sell };
    }
  }
  return out;
}

export function parseLabSell(row: Record<string, string>): number | null {
  const raw = row.sell ?? row.price ?? row.rate ?? row.selling_price ?? row.unit_price ?? '';
  if (!String(raw).trim()) return null;
  const sell = Number(raw);
  return Number.isFinite(sell) && sell >= 0 ? sell : null;
}

export function normalizeLabName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(test|serum|blood|stool|urine)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function aliasLabCatalogHeader(header: string) {
  const key = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const aliases: Record<string, string> = {
    test_code: 'code',
    test_name: 'name',
    selling_price: 'sell',
    unit_price: 'sell',
    price: 'sell',
    rate: 'sell',
    amount: 'sell',
    ksh: 'sell',
    kes: 'sell',
    test: 'name',
    investigation: 'name',
  };
  return aliases[key] ?? key;
}
