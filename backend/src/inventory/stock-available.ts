import { roundQty } from './stock-integrity';

/**
 * Units that may still be reserved or issued. Reservations never change
 * `qty_on_hand`; available is always on-hand minus currently held reservations.
 */
export function availableQuantity(onHand: number, reservedHeld: number) {
  return roundQty(Number(onHand) - Number(reservedHeld));
}

export function assertEnoughAvailable(available: number, need: number, itemName?: string) {
  if (roundQty(available) + 1e-9 >= roundQty(need)) return;
  const label = itemName ? ` for ${itemName}` : '';
  throw new Error(
    `Insufficient available stock${label}. Need ${roundQty(need)}, have ${roundQty(Math.max(0, available))} after reservations.`,
  );
}
