import { createHash, randomUUID } from 'crypto';
import { roundQty, stockVariance } from './stock-integrity';

export const MANUAL_RECEIPT_REFERENCE_TYPE = 'receipt';
export const IMPORT_RECEIPT_REFERENCE_TYPE = 'receipt_import';
export const STOCK_TAKE_REFERENCE_TYPE = 'stock_take';
export const ADVISORY_LOCK_NAMESPACE = 'afyasasa.inventory.import';

export type StockLockKey = {
  itemId: string;
  locationId: string;
  batchNo: string | null;
};

export function stockLockKey(input: StockLockKey) {
  return `${input.itemId}|${input.locationId}|${input.batchNo ?? ''}`;
}

export function sortStockLockKeys(keys: StockLockKey[]) {
  return [...keys].sort((left, right) => {
    const byItem = left.itemId.localeCompare(right.itemId);
    if (byItem !== 0) return byItem;
    const byLocation = left.locationId.localeCompare(right.locationId);
    if (byLocation !== 0) return byLocation;
    return (left.batchNo ?? '').localeCompare(right.batchNo ?? '');
  });
}

export function importSessionReferenceId(sessionKey: string) {
  const trimmed = sessionKey.trim();
  if (!trimmed) {
    throw new Error('Import session id is required before stock is posted.');
  }
  if (isUuid(trimmed)) return trimmed.toLowerCase();
  const hex = createHash('sha256').update(`afyasasa.import:${trimmed}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Client saleId is the idempotency key. Never use patientId — a patient can buy OTC more than once. */
export function otcSaleReferenceId(saleId?: string | null) {
  const trimmed = saleId?.trim();
  if (!trimmed) return randomUUID();
  return importSessionReferenceId(trimmed);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function nextOnHand(current: number, delta: number) {
  const next = roundQty(current + delta);
  if (next < 0) {
    throw new Error(`Stock movement would make quantity negative (${next}).`);
  }
  return next;
}

export function assertFreshSnapshot(expected: number | null | undefined, actual: number, line?: number) {
  if (expected == null || !Number.isFinite(expected)) return;
  if (roundQty(expected) === roundQty(actual)) return;
  const prefix = line != null ? `Line ${line}: ` : '';
  throw new Error(
    `${prefix}system quantity changed (${expected} → ${actual}) since the sheet was downloaded. Recount before posting.`,
  );
}

export function signedStockTakeVariance(counted: number, systemQty: number) {
  return stockVariance(counted, systemQty);
}

export function importLedgerReferenceType(intent: 'receipt' | 'stock_take') {
  return intent === 'stock_take' ? STOCK_TAKE_REFERENCE_TYPE : IMPORT_RECEIPT_REFERENCE_TYPE;
}

export function postgresErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const driver = (error as { driverError?: { code?: unknown } }).driverError?.code;
  return typeof driver === 'string' ? driver : null;
}

export function isUniqueViolation(error: unknown) {
  return postgresErrorCode(error) === '23505';
}

export function isUndefinedTable(error: unknown) {
  return postgresErrorCode(error) === '42P01';
}

export function isUndefinedFunction(error: unknown) {
  const code = postgresErrorCode(error);
  if (code === '42883') return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /pg_advisory_xact_lock|hashtext/i.test(message);
}

export function duplicateImportSessionMessage() {
  return 'This import session was already posted. Repeated submission did not move stock.';
}

export function dispenseOperationId(input: {
  serviceEntityId: string;
  lines: Array<{ orderId: string; quantity: number }>;
}) {
  const payload = [
    input.serviceEntityId,
    ...[...input.lines]
      .map((line) => `${line.orderId}:${roundQty(line.quantity)}`)
      .sort(),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}
