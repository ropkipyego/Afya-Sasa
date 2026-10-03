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
      realtime: { publish: jest.fn() },
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
      realtime: { publish: jest.fn() },
      getEncounter: jest.fn().mockResolvedValue({ id: 'enc-1' }),
    });

    await service.completeConsultation('c1', { user: { sub: 'u1' } } as never);
    expect(appointmentSave).not.toHaveBeenCalled();
  });
});

describe('OpdService.doctorQueue', () => {
  const doctorA = 'doc-a';
  const doctorB = 'doc-b';
  const assignedToA = {
    id: 'enc-a',
    status: 'triaged',
    startedAt: new Date('2026-10-02T07:00:00Z'),
    attendingDoctor: { id: doctorA },
    patient: { firstName: 'Ann', lastName: 'A' },
  };
  const assignedToB = {
    id: 'enc-b',
    status: 'triaged',
    startedAt: new Date('2026-10-02T07:05:00Z'),
    attendingDoctor: { id: doctorB },
    patient: { firstName: 'Ben', lastName: 'B' },
  };
  const unassigned = {
    id: 'enc-u',
    status: 'in_consultation',
    startedAt: new Date('2026-10-02T07:10:00Z'),
    attendingDoctor: null,
    patient: { firstName: 'Una', lastName: 'C' },
  };

  function queueService() {
    const service = Object.create(OpdService.prototype) as OpdService;
    Object.assign(service, {
      encounters: {
        find: jest.fn().mockResolvedValue([assignedToA, assignedToB, unassigned]),
      },
      triages: { find: jest.fn().mockResolvedValue([]) },
      visitQueue: { mapForEncounters: jest.fn().mockResolvedValue(new Map()) },
      notifyFrontOfficeOnLongQueueWait: jest.fn(),
    });
    return service;
  }

  it('returns only unassigned and Doctor A assignments to Doctor A', async () => {
    const service = queueService();
    const rows = await service.doctorQueue({
      user: { sub: doctorA, email: 'a@test', roles: ['doctor'], permissions: ['consultations:read'] },
    } as never);

    expect(rows.map((row) => row.id)).toEqual(['enc-a', 'enc-u']);
    expect(rows.every((row) => row.assignedToMe)).toBe(true);
  });

  it('hides Doctor A assignments from Doctor B', async () => {
    const service = queueService();
    const rows = await service.doctorQueue({
      user: { sub: doctorB, email: 'b@test', roles: ['doctor'], permissions: ['consultations:read'] },
    } as never);

    expect(rows.map((row) => row.id)).toEqual(['enc-b', 'enc-u']);
    expect(rows.some((row) => row.id === 'enc-a')).toBe(false);
  });

  it('rejects a doctor asking for another doctor queue', async () => {
    const service = queueService();
    await expect(
      service.doctorQueue(
        {
          user: { sub: doctorB, email: 'b@test', roles: ['doctor'], permissions: ['consultations:read'] },
        } as never,
        doctorA,
      ),
    ).rejects.toThrow(/own consultation queue/);
  });

  it('lets an administrator see the whole hospital queue', async () => {
    const service = queueService();
    const rows = await service.doctorQueue({
      user: {
        sub: 'admin-1',
        email: 'admin@test',
        roles: ['administrator'],
        permissions: ['consultations:read'],
      },
    } as never);

    expect(rows.map((row) => row.id).sort()).toEqual(['enc-a', 'enc-b', 'enc-u']);
  });
});
