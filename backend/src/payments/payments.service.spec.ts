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
});
