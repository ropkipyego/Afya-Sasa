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

describe('OpdService.completeConsultation', () => {
  it('schedules a follow-up appointment when a follow-up date is set', async () => {
    const service = Object.create(OpdService.prototype) as OpdService;
    const appointmentSave = jest.fn().mockResolvedValue({ id: 'apt-1' });
    const requireTransition = jest.fn();
    Object.assign(service, {
      consultations: {
        findOne: jest.fn().mockResolvedValue({
          id: 'c1',
          followUpDate: '2026-09-28',
          followUpInstructions: 'Review wound',
          doctor: { id: 'doc-1' },
          encounter: { id: 'enc-1', patient: { id: 'p1' }, attendingDoctor: { id: 'doc-1' } },
        }),
        update: jest.fn(),
      },
      appointments: {
        findOne: jest.fn().mockResolvedValue(null),
        save: appointmentSave,
        create: jest.fn((row) => row),
      },
      workflow: { requireTransition },
      getEncounter: jest.fn().mockResolvedValue({ id: 'enc-1' }),
    });

    await service.completeConsultation('c1', { user: { sub: 'u1' } } as never);

    expect(appointmentSave).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentDate: '2026-09-28',
        appointmentTime: '09:00',
        type: 'follow_up',
        doctorId: 'doc-1',
      }),
    );
    expect(requireTransition).toHaveBeenCalledWith('enc-1', 'completed', expect.anything());
  });

  it('does not create an appointment when no follow-up date is recorded', async () => {
    const service = Object.create(OpdService.prototype) as OpdService;
    const appointmentSave = jest.fn();
    Object.assign(service, {
      consultations: {
        findOne: jest.fn().mockResolvedValue({
          id: 'c1',
          followUpDate: null,
          doctor: { id: 'doc-1' },
          encounter: { id: 'enc-1', patient: { id: 'p1' } },
        }),
        update: jest.fn(),
      },
      appointments: { findOne: jest.fn(), save: appointmentSave, create: jest.fn() },
      workflow: { requireTransition: jest.fn() },
      getEncounter: jest.fn().mockResolvedValue({ id: 'enc-1' }),
    });

    await service.completeConsultation('c1', { user: { sub: 'u1' } } as never);
    expect(appointmentSave).not.toHaveBeenCalled();
  });
});
