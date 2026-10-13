import { PaymentsService } from './payments.service';

describe('PaymentsService M-Pesa callback idempotency', () => {
  function service(
    txn: Record<string, unknown>,
    updateResult: { affected: number },
    parseOverrides: Record<string, unknown> = {},
  ) {
    const execute = jest.fn().mockResolvedValue(updateResult);
    const andWhere = jest.fn().mockReturnValue({ execute });
    const where = jest.fn().mockReturnValue({ andWhere, execute });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const claimed = new Set<string>();
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
          ...parseOverrides,
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
      enqueueQuickbooksOnce: jest.fn(),
      qbQueue: { find: jest.fn().mockResolvedValue([]), save: jest.fn(), create: jest.fn((row) => row) },
      claimFinalizationStage: jest.fn(async (_id: string, stage: string) => {
        if (claimed.has(stage)) return false;
        claimed.add(stage);
        return true;
      }),
      unclaimFinalizationStage: jest.fn(async (_id: string, stage: string) => {
        claimed.delete(stage);
      }),
    });
    return {
      instance,
      execute,
      applyCompletedPayment: instance.applyCompletedPayment as jest.Mock,
      applyPaymentToCharge: instance.applyPaymentToCharge as jest.Mock,
      enqueueQuickbooksOnce: instance.enqueueQuickbooksOnce as jest.Mock,
      claimFinalizationStage: instance.claimFinalizationStage as jest.Mock,
      claimed,
    };
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

  it('does not complete a payment when the callback amount is missing', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: '100', metadata: {}, serviceLine: 'other' },
      { affected: 1 },
      { amount: null },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: false,
      reason: 'amount_mismatch',
    });
    expect(applyCompletedPayment).not.toHaveBeenCalled();
  });

  it('does not complete a payment when the initiated amount is invalid', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: 'free', metadata: {}, serviceLine: 'other' },
      { affected: 1 },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: false,
      reason: 'amount_mismatch',
    });
    expect(applyCompletedPayment).not.toHaveBeenCalled();
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

  it('does not complete a successful callback without a receipt number', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: '100', metadata: {}, serviceLine: 'other' },
      { affected: 1 },
      { mpesaReceiptNumber: null },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: false,
      reason: 'missing_receipt',
    });
    expect(applyCompletedPayment).not.toHaveBeenCalled();
  });

  it('does not re-apply a completed payment when the callback is replayed', async () => {
    const { instance, applyCompletedPayment, applyPaymentToCharge } = service(
      { id: 't1', status: 'completed', amount: '100', metadata: {}, serviceLine: 'laboratory' },
      { affected: 0 },
    );
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: true,
      duplicate: true,
    });
    expect(applyCompletedPayment).toHaveBeenCalledTimes(1);
    expect(applyPaymentToCharge).not.toHaveBeenCalled();
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

  it('retries downstream finalization after a lab/encounter update failure without double-applying', async () => {
    const { instance, applyCompletedPayment } = service(
      { id: 't1', status: 'initiated', amount: '100', metadata: {}, serviceLine: 'other' },
      { affected: 1 },
    );
    applyCompletedPayment
      .mockRejectedValueOnce(new Error('lab write failed'))
      .mockResolvedValueOnce(undefined);
    await expect(instance.handleMpesaCallback({ Body: {} })).rejects.toThrow('lab write failed');
    Object.assign(instance, {
      transactions: {
        ...(instance as unknown as { transactions: object }).transactions,
        findOne: jest.fn().mockResolvedValue({
          id: 't1',
          status: 'completed',
          amount: '100',
          metadata: {},
          serviceLine: 'other',
        }),
      },
    });
    (instance as unknown as { transactions: { createQueryBuilder: jest.Mock } }).transactions.createQueryBuilder =
      jest.fn().mockReturnValue({
        update: () => ({
          set: () => ({
            where: () => ({ andWhere: () => ({ execute: async () => ({ affected: 0 }) }), execute: async () => ({ affected: 0 }) }),
          }),
        }),
      });
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: true,
      duplicate: true,
    });
    expect(applyCompletedPayment).toHaveBeenCalledTimes(2);
  });

  it('retries QuickBooks enqueue after a queue write failure without inserting twice', async () => {
    const { instance, enqueueQuickbooksOnce, applyCompletedPayment } = service(
      {
        id: 't1',
        status: 'initiated',
        amount: '100',
        metadata: {},
        serviceLine: 'laboratory',
        serviceEntityId: 'lab-1',
      },
      { affected: 1 },
    );
    enqueueQuickbooksOnce.mockRejectedValueOnce(new Error('qb write failed')).mockResolvedValueOnce({ id: 'q1' });
    await expect(instance.handleMpesaCallback({ Body: {} })).rejects.toThrow('qb write failed');
    expect(applyCompletedPayment).toHaveBeenCalledTimes(1);
    Object.assign(instance, {
      transactions: {
        findOne: jest.fn().mockResolvedValue({
          id: 't1',
          status: 'completed',
          amount: '100',
          metadata: {},
          serviceLine: 'laboratory',
          serviceEntityId: 'lab-1',
        }),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: () => ({
            set: () => ({
              where: () => ({
                andWhere: () => ({ execute: async () => ({ affected: 0 }) }),
                execute: async () => ({ affected: 0 }),
              }),
            }),
          }),
        }),
      },
    });
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: true,
      duplicate: true,
    });
    expect(enqueueQuickbooksOnce).toHaveBeenCalledTimes(2);
    expect(applyCompletedPayment).toHaveBeenCalledTimes(1);
  });

  it('retries charge application after a charge write failure without paying twice on the successful retry', async () => {
    const { instance, applyPaymentToCharge } = service(
      {
        id: 't1',
        status: 'initiated',
        amount: '100',
        metadata: { chargeId: 'c1' },
        chargeId: 'c1',
        patient: { id: 'p1' },
        serviceLine: 'other',
      },
      { affected: 1 },
    );
    (instance as unknown as { lockChargeForPayment: jest.Mock }).lockChargeForPayment = jest
      .fn()
      .mockResolvedValue({ id: 'c1', patient: { id: 'p1' }, amountPaid: '0', amountOwed: '100', amountWaived: '0' });
    applyPaymentToCharge.mockRejectedValueOnce(new Error('charge write failed')).mockResolvedValueOnce(undefined);
    await expect(instance.handleMpesaCallback({ Body: {} })).rejects.toThrow('charge write failed');
    Object.assign(instance, {
      transactions: {
        findOne: jest.fn().mockResolvedValue({
          id: 't1',
          status: 'completed',
          amount: '100',
          metadata: { chargeId: 'c1' },
          chargeId: 'c1',
          patient: { id: 'p1' },
          serviceLine: 'other',
        }),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: () => ({
            set: () => ({
              where: () => ({
                andWhere: () => ({ execute: async () => ({ affected: 0 }) }),
                execute: async () => ({ affected: 0 }),
              }),
            }),
          }),
        }),
      },
    });
    await expect(instance.handleMpesaCallback({ Body: {} })).resolves.toEqual({
      ok: true,
      duplicate: true,
    });
    expect(applyPaymentToCharge).toHaveBeenCalledTimes(2);
  });
});
