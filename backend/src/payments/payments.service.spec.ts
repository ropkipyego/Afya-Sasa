import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

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
