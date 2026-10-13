import {
  amountsMatch,
  callbackIpAllowlistRequired,
  callbackPeerAddress,
  callbackSourceAllowed,
  parseIpAllowlist,
  parseStkCallback,
} from './mpesa-callback.contract';

const valid = {
  Body: {
    stkCallback: {
      MerchantRequestID: 'm-1',
      CheckoutRequestID: 'ws_CO_1',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 100 },
          { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
          { Name: 'PhoneNumber', Value: 254700000000 },
        ],
      },
    },
  },
};

describe('Daraja STK callback contract', () => {
  it('accepts a well-formed successful STK callback', () => {
    const parsed = parseStkCallback(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.checkoutRequestId).toBe('ws_CO_1');
    expect(parsed.success).toBe(true);
    expect(parsed.mpesaReceiptNumber).toBe('NLJ7RT61SV');
    expect(parsed.amount).toBe(100);
  });

  it('rejects a body that is not an STK callback', () => {
    expect(parseStkCallback({})).toEqual({ ok: false, reason: 'invalid_callback_contract' });
    expect(parseStkCallback({ CheckoutRequestID: 'ws_CO_1' })).toEqual({
      ok: false,
      reason: 'invalid_callback_contract',
    });
  });

  it('rejects a callback without CheckoutRequestID', () => {
    expect(
      parseStkCallback({ Body: { stkCallback: { ResultCode: 0 } } }),
    ).toEqual({ ok: false, reason: 'missing_checkout_id' });
  });

  it('rejects a non-numeric ResultCode instead of treating it as success or failure', () => {
    expect(
      parseStkCallback({
        Body: { stkCallback: { CheckoutRequestID: 'ws_CO_1', ResultCode: 'paid' } },
      }),
    ).toEqual({ ok: false, reason: 'invalid_callback_contract' });
  });

  it('does not parse amount from malformed metadata items', () => {
    const parsed = parseStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'ws_CO_1',
          ResultCode: 0,
          CallbackMetadata: { Item: 'not-an-array' },
        },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.amount).toBeNull();
    expect(parsed.mpesaReceiptNumber).toBeNull();
  });

  it('treats a non-zero ResultCode as an unsuccessful payment', () => {
    const parsed = parseStkCallback({
      Body: { stkCallback: { CheckoutRequestID: 'ws_CO_1', ResultCode: 1032 } },
    });
    expect(parsed.ok && parsed.success).toBe(false);
  });

  it('requires both amounts to be present and finite before matching', () => {
    expect(amountsMatch('100.00', 100)).toBe(true);
    expect(amountsMatch('50', 100)).toBe(false);
    expect(amountsMatch('100', null)).toBe(false);
    expect(amountsMatch(null, 100)).toBe(false);
    expect(amountsMatch('', 100)).toBe(false);
    expect(amountsMatch('not-a-number', 100)).toBe(false);
  });

  it('allows any source when the IP allowlist is empty outside production', () => {
    expect(callbackSourceAllowed('8.8.8.8', [], { NODE_ENV: 'development' })).toBe(true);
    expect(callbackSourceAllowed('1.2.3.4', parseIpAllowlist('10.0.0.1, 1.2.3.4'))).toBe(true);
    expect(callbackSourceAllowed('9.9.9.9', parseIpAllowlist('10.0.0.1'))).toBe(false);
    expect(callbackSourceAllowed(undefined, parseIpAllowlist('10.0.0.1'))).toBe(false);
  });

  it('fails closed in production when the callback allowlist is required but missing', () => {
    expect(callbackIpAllowlistRequired({ NODE_ENV: 'production' })).toBe(true);
    expect(
      callbackSourceAllowed('1.2.3.4', [], { NODE_ENV: 'production' }),
    ).toBe(false);
    expect(
      callbackSourceAllowed('1.2.3.4', [], {
        NODE_ENV: 'production',
        MPESA_CALLBACK_REQUIRE_IP_ALLOWLIST: 'false',
      }),
    ).toBe(true);
  });

  it('uses the TCP peer and does not read forwarded headers', () => {
    expect(
      callbackPeerAddress({
        socket: { remoteAddress: '10.0.0.8' },
        ip: '8.8.8.8',
      }),
    ).toBe('10.0.0.8');
  });
});
