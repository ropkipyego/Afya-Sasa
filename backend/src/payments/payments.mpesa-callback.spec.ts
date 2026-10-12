import { PaymentsService } from './payments.service';

describe('PaymentsService M-Pesa callback idempotency', () => {
  function service(txn: Record<string, unknown>, updateResult: { affected: number }) {
    const execute = jest.fn().mockResolvedValue(updateResult);
    const where = jest.fn().mockReturnValue({ execute });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const instance = Object.create(PaymentsService.prototype) as PaymentsService;
    Object.assign(instance, {
      mpesa: {
        parseCallback: () => ({
          ok: true as const,
          success: true,
          checkoutRequestId: 'ws_CO_1',
          mpesaReceiptNumber: 'NLJ7RT61SV',
          amount: 100,
          phone: '254700000000',
          raw: {},
        }),
      },
      transactions: {
        findOne: jest.fn().mockResolvedValue(txn),
        createQueryBuilder: jest.fn().mockReturnValue({ update }),
      },
      lockChargeForPayment: jest.fn(),
      applyPaymentToCharge: jest.fn(),
      applyCompletedPayment: jest.fn(),
      enqueueQuickbooks: jest.fn(),
    });
    return { instance, execute, applyCompletedPayment: instance.applyCompletedPayment as jest.Mock };
  }

  it('returns missing_checkout_id when the payload has no correlation id', async () => {
    const instance = Object.create(PaymentsService.prototype) as PaymentsService;
    Object.assign(instance, {
      mpesa: { parseCallback: () => ({ ok: false as const, reason: 'missing_checkout_id' }) },
    });
    await expect(instance.handleMpesaCallback({})).resolves.toEqual({
      ok: false,
      reason: 'missing_checkout_id',
    });
  });

  it('does not re-apply a completed payment when the callback is replayed', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: '100', metadata: {}, serviceLine: 'laboratory' },
      { affected: 0 },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: true,
      duplicate: true,
    });
    expect(applyCompletedPayment).not.toHaveBeenCalled();
  });

  it('applies a successful first callback', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: '100', metadata: {}, serviceLine: 'other' },
      { affected: 1 },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: true,
      duplicate: false,
    });
    expect(applyCompletedPayment).toHaveBeenCalledTimes(1);
  });

  it('does not complete a payment when the callback amount disagrees with the initiated amount', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: '50', metadata: {}, serviceLine: 'other' },
      { affected: 1 },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: false,
      reason: 'amount_mismatch',
    });
    expect(applyCompletedPayment).not.toHaveBeenCalled();
  });
});
