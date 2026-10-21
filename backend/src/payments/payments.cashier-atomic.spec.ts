import { BadRequestException, NotFoundException } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY } from '../core/auth/auth.decorators';
import { Charge } from './charge.entities';
import { PaymentTransaction } from './payment.entities';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

type FailOn = 'payment' | 'charge' | null;

function request() {
  return { user: { sub: 'cashier-1' } } as never;
}

function manualDto(overrides: Record<string, unknown> = {}) {
  return {
    patientId: 'p1',
    serviceLine: 'consultation',
    method: 'cash',
    amount: 40,
    chargeId: 'chg-1',
    ...overrides,
  } as never;
}

function buildService(options: {
  failOn?: FailOn;
  existingByKey?: PaymentTransaction | null;
  remainingPaid?: string;
  patient?: { id: string; patientNo: string } | null;
}) {
  const stagingPayments: PaymentTransaction[] = [];
  const stagingCharges: Charge[] = [];
  const committedPayments: PaymentTransaction[] = [];
  const committedCharges: Charge[] = [];

  const chargeState: Charge = {
    id: 'chg-1',
    patient: { id: 'p1' },
    status: 'owed',
    amountOwed: '100',
    amountPaid: options.remainingPaid ?? '0',
    amountWaived: '0',
  } as Charge;

  const txnRepo = {
    create: (row: PaymentTransaction) => row,
    save: async (row: PaymentTransaction) => {
      if (options.failOn === 'payment') throw new Error('Forced payment failure');
      const saved = { ...row, id: `txn-${stagingPayments.length + 1}` } as PaymentTransaction;
      stagingPayments.push(saved);
      return saved;
    },
    createQueryBuilder: () => ({
      leftJoinAndSelect() {
        return this;
      },
      where() {
        return this;
      },
      orderBy() {
        return this;
      },
      getOne: async () => options.existingByKey ?? null,
    }),
    findOne: async () => null,
  };

  const chargeRepo = {
    findOne: async () => ({ ...chargeState, patient: { id: 'p1' } }) as Charge,
    save: async (row: Charge) => {
      if (options.failOn === 'charge') throw new Error('Forced charge failure');
      stagingCharges.push({ ...row });
      return row;
    },
  };

  const manager = {
    getRepository(entity: unknown) {
      if (entity === PaymentTransaction) return txnRepo;
      if (entity === Charge) return chargeRepo;
      throw new Error('unexpected repository');
    },
  };

  const service = Object.create(PaymentsService.prototype) as PaymentsService;
  Object.assign(service, {
    patients: {
      findOne: async () => options.patient !== undefined ? options.patient : { id: 'p1', patientNo: 'JH-1' },
    },
    labRequests: { findOne: async () => null, update: jest.fn() },
    encounters: { update: jest.fn() },
    charges: chargeRepo,
    transactions: {
      manager: {
        transaction: async (fn: (m: typeof manager) => Promise<unknown>) => {
          try {
            const result = await fn(manager);
            committedPayments.push(...stagingPayments.splice(0));
            committedCharges.push(...stagingCharges.splice(0));
            return result;
          } catch (error) {
            stagingPayments.length = 0;
            stagingCharges.length = 0;
            throw error;
          }
        },
      },
      createQueryBuilder: txnRepo.createQueryBuilder,
      findOne: txnRepo.findOne,
    },
    clinicalOrders: { find: async () => [] },
    qbQueue: { find: async () => [], save: jest.fn() },
  });

  return { service, committedPayments, committedCharges };
}

describe('cashier payment authorization', () => {
  it('requires payments:initiate for manual cashier payments', () => {
    const keys = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      PaymentsController.prototype.recordManual,
    );
    expect(keys).toEqual(['payments:initiate']);
  });
});

describe('atomic cashier payment and charge update', () => {
  const previous = process.env.AFYASASA_CHARGES_ENABLED;

  beforeEach(() => {
    process.env.AFYASASA_CHARGES_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.AFYASASA_CHARGES_ENABLED = previous;
  });

  it('writes payment and charge together on success', async () => {
    const { service, committedPayments, committedCharges } = buildService({});
    const txn = await service.recordManualPayment(manualDto(), request());
    expect(txn.status).toBe('completed');
    expect(txn.amount).toBe('40');
    expect(txn.chargeId).toBe('chg-1');
    expect(committedPayments).toHaveLength(1);
    expect(committedCharges).toHaveLength(1);
    expect(committedCharges[0].amountPaid).toBe('40');
    expect(committedCharges[0].status).toBe('partially_paid');
  });

  it('rolls back the charge when payment write fails', async () => {
    const { service, committedPayments, committedCharges } = buildService({ failOn: 'payment' });
    await expect(service.recordManualPayment(manualDto(), request())).rejects.toThrow(
      /Forced payment failure/,
    );
    expect(committedPayments).toHaveLength(0);
    expect(committedCharges).toHaveLength(0);
  });

  it('rolls back the payment when charge update fails', async () => {
    const { service, committedPayments, committedCharges } = buildService({ failOn: 'charge' });
    await expect(service.recordManualPayment(manualDto(), request())).rejects.toThrow(
      /Forced charge failure/,
    );
    expect(committedPayments).toHaveLength(0);
    expect(committedCharges).toHaveLength(0);
  });

  it('returns the original row for a duplicate idempotency key without a second write', async () => {
    const existing = {
      id: 'txn-existing',
      status: 'completed',
      amount: '40',
      metadata: { idempotencyKey: 'desk-1' },
      externalReference: 'JH-RCP-2026-00001',
    } as PaymentTransaction;
    const { service, committedPayments, committedCharges } = buildService({ existingByKey: existing });
    const txn = await service.recordManualPayment(manualDto({ idempotencyKey: 'desk-1' }), request());
    expect(txn.id).toBe('txn-existing');
    expect(committedPayments).toHaveLength(0);
    expect(committedCharges).toHaveLength(0);
  });

  it('rejects an invalid amount before opening a financial transaction', async () => {
    const { service, committedPayments } = buildService({});
    expect(() => service.assertAmount(-5, false)).toThrow(BadRequestException);
    await expect(service.recordManualPayment(manualDto({ amount: 0 }), request())).rejects.toThrow(
      /greater than zero/,
    );
    expect(committedPayments).toHaveLength(0);
  });

  it('rejects a missing patient before writing', async () => {
    const { service, committedPayments } = buildService({ patient: null });
    await expect(service.recordManualPayment(manualDto(), request())).rejects.toThrow(NotFoundException);
    expect(committedPayments).toHaveLength(0);
  });

  it('rejects a payment that exceeds the remaining charge balance', async () => {
    const { service, committedPayments, committedCharges } = buildService({ remainingPaid: '80' });
    await expect(service.recordManualPayment(manualDto({ amount: 40 }), request())).rejects.toThrow(
      /exceeds remaining/,
    );
    expect(committedPayments).toHaveLength(0);
    expect(committedCharges).toHaveLength(0);
  });

  it('allows a retry after a rolled-back charge failure', async () => {
    const first = buildService({ failOn: 'charge' });
    await expect(first.service.recordManualPayment(manualDto(), request())).rejects.toThrow(
      /Forced charge failure/,
    );
    expect(first.committedPayments).toHaveLength(0);

    const second = buildService({});
    const txn = await second.service.recordManualPayment(manualDto(), request());
    expect(txn.id).toBe('txn-1');
    expect(second.committedPayments).toHaveLength(1);
    expect(second.committedCharges[0].amountPaid).toBe('40');
  });

  it('marks a charge paid when the remaining balance is cleared', async () => {
    const { service, committedCharges } = buildService({ remainingPaid: '60' });
    await service.recordManualPayment(manualDto({ amount: 40 }), request());
    expect(committedCharges[0].status).toBe('paid');
    expect(committedCharges[0].amountPaid).toBe('100');
  });
});
