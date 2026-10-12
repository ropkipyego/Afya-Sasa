/**
 * Daraja STK callback contract (JSON posted to the registered CallBackURL).
 * Safaricom does not sign this body. Correlation is CheckoutRequestID that we stored
 * when initiating STK. Optional IP allowlisting is a network control, not a signature.
 */
export type StkCallbackParse =
  | { ok: false; reason: 'invalid_callback_contract' | 'missing_checkout_id' }
  | {
      ok: true;
      success: boolean;
      checkoutRequestId: string;
      mpesaReceiptNumber: string | null;
      amount: number | null;
      phone: string | null;
      raw: Record<string, unknown>;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseStkCallback(body: Record<string, unknown> | null | undefined): StkCallbackParse {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'invalid_callback_contract' };
  }
  const wrapper = asRecord(body.Body);
  const callback = asRecord(wrapper?.stkCallback) ?? asRecord(body.stkCallback);
  if (!callback) {
    return { ok: false, reason: 'invalid_callback_contract' };
  }
  if (!('ResultCode' in callback) && !('resultCode' in callback)) {
    return { ok: false, reason: 'invalid_callback_contract' };
  }
  const checkoutRequestId = String(callback.CheckoutRequestID ?? callback.checkoutRequestId ?? '').trim();
  if (!checkoutRequestId) {
    return { ok: false, reason: 'missing_checkout_id' };
  }
  const resultCode = Number(callback.ResultCode ?? callback.resultCode);
  const metadata = asRecord(callback.CallbackMetadata);
  const items = Array.isArray(metadata?.Item) ? metadata.Item : [];
  let mpesaReceiptNumber: string | null = null;
  let amount: number | null = null;
  let phone: string | null = null;
  for (const raw of items) {
    const item = asRecord(raw);
    if (!item) continue;
    const name = String(item.Name ?? '');
    if (name === 'MpesaReceiptNumber' && item.Value != null) mpesaReceiptNumber = String(item.Value);
    if (name === 'Amount' && item.Value != null) amount = Number(item.Value);
    if (name === 'PhoneNumber' && item.Value != null) phone = String(item.Value);
  }
  return {
    ok: true,
    success: resultCode === 0,
    checkoutRequestId,
    mpesaReceiptNumber,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    phone,
    raw: body,
  };
}

export function amountsMatch(expected: string | number | null | undefined, received: number | null) {
  if (received == null || expected == null || expected === '') return true;
  const wanted = Number(expected);
  if (!Number.isFinite(wanted)) return true;
  return Math.abs(wanted - received) < 0.01;
}

export function callbackSourceAllowed(remoteAddress: string | undefined, allowlist: string[]) {
  if (!allowlist.length) return true;
  const ip = (remoteAddress ?? '').replace(/^::ffff:/, '').trim();
  return allowlist.includes(ip);
}

export function parseIpAllowlist(raw: string | undefined) {
  return (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
