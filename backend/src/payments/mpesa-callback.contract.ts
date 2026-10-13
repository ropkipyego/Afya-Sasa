/**
 * Daraja STK callback contract (JSON posted to the registered CallBackURL).
 * Safaricom does not sign this body. Correlation is the CheckoutRequestID we stored
 * when initiating STK. IP allowlisting is a network control, not cryptographic
 * callback authentication. Do not invent Safaricom IP ranges here.
 *
 * Express `trust proxy` is not enabled in `main.ts`. Do not read X-Forwarded-For
 * until Nginx `real_ip` / `set_real_ip_from` is verified and trust proxy is set
 * to the reverse-proxy hop count only.
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

/** KES STK amounts are whole shillings; keep a one-cent tolerance for numeric/string forms. */
export const MPESA_AMOUNT_TOLERANCE = 0.01;

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
  const rawResult = callback.ResultCode ?? callback.resultCode;
  if (rawResult === '' || rawResult == null) {
    return { ok: false, reason: 'invalid_callback_contract' };
  }
  const resultCode = Number(rawResult);
  if (!Number.isFinite(resultCode)) {
    return { ok: false, reason: 'invalid_callback_contract' };
  }
  const metadata = asRecord(callback.CallbackMetadata);
  const items = Array.isArray(metadata?.Item) ? metadata.Item : [];
  let mpesaReceiptNumber: string | null = null;
  let amount: number | null = null;
  let phone: string | null = null;
  for (const raw of items) {
    const item = asRecord(raw);
    if (!item) continue;
    const name = String(item.Name ?? '');
    if (name === 'MpesaReceiptNumber' && item.Value != null && String(item.Value).trim()) {
      mpesaReceiptNumber = String(item.Value).trim();
    }
    if (name === 'Amount' && item.Value != null && item.Value !== '') {
      const parsedAmount = Number(item.Value);
      amount = Number.isFinite(parsedAmount) ? parsedAmount : null;
    }
    if (name === 'PhoneNumber' && item.Value != null) phone = String(item.Value);
  }
  return {
    ok: true,
    success: resultCode === 0,
    checkoutRequestId,
    mpesaReceiptNumber,
    amount,
    phone,
    raw: body,
  };
}

export function amountsMatch(expected: string | number | null | undefined, received: number | null) {
  if (received == null || !Number.isFinite(received)) return false;
  if (expected == null || expected === '') return false;
  const wanted = Number(expected);
  if (!Number.isFinite(wanted)) return false;
  return Math.abs(wanted - received) < MPESA_AMOUNT_TOLERANCE;
}

/** Production must set MPESA_CALLBACK_ALLOWED_IPS. Empty allowlist is open only outside production. */
export function callbackIpAllowlistRequired(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production' && env.MPESA_CALLBACK_REQUIRE_IP_ALLOWLIST !== 'false';
}

export function callbackSourceAllowed(
  remoteAddress: string | undefined,
  allowlist: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!allowlist.length) {
    return !callbackIpAllowlistRequired(env);
  }
  const ip = (remoteAddress ?? '').replace(/^::ffff:/, '').trim();
  if (!ip) return false;
  return allowlist.includes(ip);
}

/** TCP peer only. Do not use X-Forwarded-For here. */
export function callbackPeerAddress(request: {
  socket?: { remoteAddress?: string };
  ip?: string;
}) {
  return request.socket?.remoteAddress ?? request.ip;
}

export function parseIpAllowlist(raw: string | undefined) {
  return (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
