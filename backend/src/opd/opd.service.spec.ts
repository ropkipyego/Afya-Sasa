import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OpdService } from './opd.service';

describe('OpdService.createEncounter', () => {
  function serviceStub() {
    return Object.create(OpdService.prototype) as OpdService;
  }

  it('rejects check-in when the patient does not exist', async () => {
    const service = serviceStub();
    Object.assign(service, {
      patients: { findOne: jest.fn().mockResolvedValue(null) },
      encounters: { findOne: jest.fn(), save: jest.fn() },
    });

    await expect(
      service.createEncounter({ patientId: 'missing' } as never, { user: { sub: 'u1' } } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a second open OPD visit the same day', async () => {
    const service = serviceStub();
    const save = jest.fn();
    Object.assign(service, {
      patients: { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) },
      encounters: {
        findOne: jest.fn().mockResolvedValue({
          encounterNo: 'JAL-E-2026-0100',
          status: 'registered',
        }),
        save,
      },
    });

    await expect(
      service.createEncounter({ patientId: 'p1', visitType: 'new' } as never, {
        user: { sub: 'u1' },
      } as never),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createEncounter({ patientId: 'p1', visitType: 'new' } as never, {
        user: { sub: 'u1' },
      } as never),
    ).rejects.toThrow(/already has an open OPD visit today/);
    expect(save).not.toHaveBeenCalled();
  });
});
