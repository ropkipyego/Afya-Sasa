import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('pharmacy charge idempotency', () => {
  it('does not add amount again for the same dispense operation', async () => {
    const existing = {
      status: 'owed',
      amountOwed: '40',
      amountPaid: '0',
      amountWaived: '0',
      metadata: { dispenseOps: ['op-dup'] },
    };
    const service = Object.create(PaymentsService.prototype) as PaymentsService;
    Object.assign(service, {
      charges: {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn(),
        create: jest.fn(),
      },
    });
    const original = process.env.AFYASASA_CHARGES_ENABLED;
    process.env.AFYASASA_CHARGES_ENABLED = 'true';
    const result = await service.upsertPharmacyCharge({
      patientId: 'p1',
      encounterId: null,
      serviceEntityId: 'g1',
      description: 'Para',
      amountDelta: 40,
      userId: 'u1',
      dispenseOpId: 'op-dup',
    });
    process.env.AFYASASA_CHARGES_ENABLED = original;
    expect(result).toBe(existing);
    expect(
      (service as unknown as { charges: { save: jest.Mock } }).charges.save,
    ).not.toHaveBeenCalled();
  });
});

describe('PaymentsService amount rules', () => {
  const service = Object.create(PaymentsService.prototype) as PaymentsService;

  it('rejects negative and missing amounts', () => {
    expect(() => service.assertAmount(undefined, false)).toThrow(BadRequestException);
    expect(() => service.assertAmount(-10, false)).toThrow(/cannot be negative/);
    expect(() => service.assertAmount(0, false)).toThrow(/greater than zero/);
  });

  it('allows a zero waived amount', () => {
    expect(() => service.assertAmount(0, true)).not.toThrow();
    expect(() => service.assertAmount(250, false)).not.toThrow();
  });

  it('acquires PostgreSQL advisory lock on idempotencyKey and replays existing transaction without creating a second payment or receipt', async () => {
    const existingTxn = {
      id: 'txn-existing-1',
      status: 'completed',
      amount: '500',
      externalReference: 'JH-RCP-2026-00001',
    };
    const query = jest.fn().mockResolvedValue([]);
    const save = jest.fn();
    const instance = Object.create(PaymentsService.prototype) as PaymentsService;
    Object.assign(instance, {
      patients: { findOne: jest.fn().mockResolvedValue({ id: 'p1', patientNo: 'JAL-1' }) },
      findByIdempotencyKey: jest
        .fn()
        .mockResolvedValueOnce(null) // pre-transaction check
        .mockResolvedValueOnce(existingTxn), // inside transaction after advisory lock
      assertNoRecentDuplicate: jest.fn().mockResolvedValue(undefined),
      resolveLabRequest: jest.fn().mockResolvedValue(null),
      transactions: {
        manager: {
          transaction: jest.fn(async (cb: (mgr: unknown) => Promise<unknown>) =>
            cb({
              query,
              getRepository: () => ({ save, create: jest.fn() }),
            }),
          ),
        },
      },
    });

    const result = await instance.recordManualPayment(
      {
        patientId: 'p1',
        serviceLine: 'consultation',
        method: 'cash',
        amount: 500,
        idempotencyKey: 'idem-key-123',
      } as never,
      { user: { sub: 'cashier-1' } } as never,
    );

    expect(query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['afyasasa.payments.idempotency', 'idem-key-123'],
    );
    expect(result).toBe(existingTxn);
    expect(save).not.toHaveBeenCalled();
  });
});
