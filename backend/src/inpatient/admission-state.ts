import { BadRequestException } from '@nestjs/common';

export function assertActiveAdmission(
  status: string | null | undefined,
  action: string,
): asserts status is 'active' {
  if (status === 'active') return;
  if (!status) {
    throw new BadRequestException(`Cannot ${action} without an active admission.`);
  }
  throw new BadRequestException(`Cannot ${action} on a ${status} admission.`);
}
