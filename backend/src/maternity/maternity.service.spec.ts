import { BadRequestException } from '@nestjs/common';
import { MaternityService } from './maternity.service';

describe('MaternityService.admitToUnit', () => {
  it('refuses a second active stay on the same unit', async () => {
    const service = Object.create(MaternityService.prototype) as MaternityService;
    Object.assign(service, {
      patients: { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) },
      unitAdmissions: {
        findOne: jest.fn().mockResolvedValue({ id: 'stay-1' }),
        save: jest.fn(),
      },
    });

    await expect(
      service.admitToUnit(
        { patientId: 'p1', unit: 'labour' } as never,
        { user: { sub: 'u1' } } as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
