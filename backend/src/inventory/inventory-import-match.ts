export type InventoryImportMatch = 'new' | 'exact_sku' | 'exact_name' | 'likely_name';

export function normalizeProductName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function classifyInventoryMatch(input: {
  sku: string;
  name: string;
  existingBySku?: { sku: string; name: string } | null;
  existingByName?: { sku: string; name: string } | null;
}): { match: InventoryImportMatch; existingSku?: string; existingName?: string } {
  if (input.existingBySku) {
    return {
      match: 'exact_sku',
      existingSku: input.existingBySku.sku,
      existingName: input.existingBySku.name,
    };
  }
  if (input.existingByName) {
    const sameName =
      normalizeProductName(input.existingByName.name) === normalizeProductName(input.name);
    return {
      match: sameName ? 'exact_name' : 'likely_name',
      existingSku: input.existingByName.sku,
      existingName: input.existingByName.name,
    };
  }
  return { match: 'new' };
}

export function likelyNameMatch(a: string, b: string) {
  const left = normalizeProductName(a).replace(/ /g, '');
  const right = normalizeProductName(b).replace(/ /g, '');
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 6 || right.length < 6) return false;
  return left.includes(right) || right.includes(left);
}
