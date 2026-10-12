import {
  amountsMatch,
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

  it('treats a non-zero ResultCode as an unsuccessful payment', () => {
    const parsed = parseStkCallback({
      Body: { stkCallback: { CheckoutRequestID: 'ws_CO_1', ResultCode: 1032 } },
    });
    expect(parsed.ok && parsed.success).toBe(false);
  });

  it('detects amount mismatch against the initiated transaction', () => {
    expect(amountsMatch('100.00', 100)).toBe(true);
    expect(amountsMatch('50', 100)).toBe(false);
    expect(amountsMatch('100', null)).toBe(true);
  });

  it('allows any source when the IP allowlist is empty', () => {
    expect(callbackSourceAllowed('8.8.8.8', [])).toBe(true);
    expect(callbackSourceAllowed('1.2.3.4', parseIpAllowlist('10.0.0.1, 1.2.3.4'))).toBe(true);
    expect(callbackSourceAllowed('9.9.9.9', parseIpAllowlist('10.0.0.1'))).toBe(false);
  });
});
