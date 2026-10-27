import { ConflictException, NotFoundException } from '@nestjs/common';
import { NursingService } from './nursing.service';

describe('NursingService MAR uniqueness', () => {
  it('rejects a second scheduled MAR for the same admission, drug, dose and time', async () => {
    const service = Object.create(NursingService.prototype) as NursingService;
    Object.assign(service, {
      admissions: { findOne: jest.fn().mockResolvedValue({ id: 'adm-1', status: 'active' }) },
      mar: {
        findOne: jest.fn().mockResolvedValue({ id: 'mar-existing' }),
        create: jest.fn(),
        save: jest.fn(),
      },
    });

    await expect(
      service.createMar(
        {
          admissionId: 'adm-1',
          medicationName: 'Paracetamol',
          dosage: '500mg',
          route: 'oral',
          frequency: 'TDS',
          scheduledTime: '2026-10-12T08:00:00.000Z',
        },
        { user: { sub: 'nurse-1' } } as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(service['mar'].save).not.toHaveBeenCalled();
  });

  it('rejects MAR creation after discharge', async () => {
    const service = Object.create(NursingService.prototype) as NursingService;
    Object.assign(service, {
      admissions: { findOne: jest.fn().mockResolvedValue({ id: 'adm-1', status: 'discharged' }) },
      mar: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
    });
    await expect(
      service.createMar(
        {
          admissionId: 'adm-1',
          medicationName: 'Paracetamol',
          dosage: '500mg',
          route: 'oral',
          frequency: 'TDS',
          scheduledTime: '2026-10-12T08:00:00.000Z',
        },
        { user: { sub: 'nurse-1' } } as never,
      ),
    ).rejects.toThrow(/discharged admission/);
    expect(service['mar'].save).not.toHaveBeenCalled();
  });

  it('rejects MAR status changes after discharge', async () => {
    const service = Object.create(NursingService.prototype) as NursingService;
    Object.assign(service, {
      mar: {
        findOne: jest.fn().mockResolvedValue({ id: 'mar-1', admission: { id: 'adm-1', status: 'discharged' } }),
        update: jest.fn(),
        findOneOrFail: jest.fn(),
      },
    });
    await expect(
      service.updateMarStatus('mar-1', { status: 'given' }, { user: { sub: 'nurse-1' } } as never),
    ).rejects.toThrow(/discharged admission/);
    expect(service['mar'].update).not.toHaveBeenCalled();
  });

  it('rejects MAR creation when the admission does not exist', async () => {
    const service = Object.create(NursingService.prototype) as NursingService;
    Object.assign(service, {
      admissions: { findOne: jest.fn().mockResolvedValue(null) },
      mar: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
    });
    await expect(
      service.createMar(
        {
          admissionId: 'missing',
          medicationName: 'Paracetamol',
          dosage: '500mg',
          route: 'oral',
          frequency: 'TDS',
          scheduledTime: '2026-10-12T08:00:00.000Z',
        },
        { user: { sub: 'nurse-1' } } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
