import { BadRequestException } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

describe('EmergencyService IPD admission', () => {
  it('does not complete the encounter when disposing to IPD', async () => {
    const service = Object.create(EmergencyService.prototype) as EmergencyService;
    const requireTransition = jest.fn();
    const createAdmission = jest.fn().mockResolvedValue({ id: 'adm-1' });
    Object.assign(service, {
      emergencies: {
        findOne: jest.fn().mockResolvedValue({
          id: 'ed-1',
          status: 'active',
          workflowStage: 'treatment',
          encounter: { id: 'enc-1', patient: { id: 'p1' } },
          bay: null,
        }),
        update: jest.fn(),
        findOneOrFail: jest.fn().mockResolvedValue({ id: 'ed-1' }),
      },
      encounters: { findOne: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'triaged' }) },
      bays: { update: jest.fn() },
      inpatientService: {
        findActiveAdmissionForEncounter: jest.fn().mockResolvedValue(null),
        findActiveAdmissionForPatient: jest.fn().mockResolvedValue(null),
        createAdmission,
      },
      encounterWorkflow: { requireTransition },
    });

    await service.disposition(
      'ed-1',
      { outcome: 'admitted_ipd', bedId: 'bed-1', notes: 'From ED' } as never,
      { user: { sub: 'u1' } } as never,
    );

    expect(createAdmission).toHaveBeenCalled();
    expect(requireTransition).not.toHaveBeenCalledWith('enc-1', 'completed', expect.anything());
  });

  it('does not complete the encounter when transferring to ICU', async () => {
    const service = Object.create(EmergencyService.prototype) as EmergencyService;
    const requireTransition = jest.fn();
    const createAdmission = jest.fn().mockResolvedValue({ id: 'adm-1' });
    const admitIcu = jest.fn().mockResolvedValue({ id: 'icu-1' });
    Object.assign(service, {
      emergencies: {
        findOne: jest.fn().mockResolvedValue({
          id: 'ed-1',
          status: 'active',
          workflowStage: 'treatment',
          encounter: { id: 'enc-1', patient: { id: 'p1' } },
          bay: null,
        }),
        update: jest.fn(),
        findOneOrFail: jest.fn().mockResolvedValue({ id: 'ed-1' }),
      },
      encounters: { findOne: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'triaged' }) },
      bays: { update: jest.fn() },
      inpatientService: {
        findActiveAdmissionForEncounter: jest.fn().mockResolvedValue(null),
        findActiveAdmissionForPatient: jest.fn().mockResolvedValue(null),
        createAdmission,
      },
      icuService: { admit: admitIcu },
      hduService: { admit: jest.fn() },
      encounterWorkflow: { requireTransition },
    });

    await service.disposition(
      'ed-1',
      { outcome: 'transferred_icu', bedId: 'bed-1', notes: 'Unstable' } as never,
      { user: { sub: 'u1' } } as never,
    );

    expect(createAdmission).toHaveBeenCalled();
    expect(admitIcu).toHaveBeenCalledWith(
      expect.objectContaining({ admissionId: 'adm-1', icuBedId: 'bed-1' }),
      expect.anything(),
    );
    expect(requireTransition).not.toHaveBeenCalledWith('enc-1', 'completed', expect.anything());
  });

  it('rejects a second active emergency registration', async () => {
    const service = Object.create(EmergencyService.prototype) as EmergencyService;
    Object.assign(service, {
      patients: { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) },
      emergencies: { findOne: jest.fn().mockResolvedValue({ id: 'ed-open' }) },
    });

    await expect(
      service.register({ patientId: 'p1', chiefComplaint: 'Chest pain' } as never, {
        user: { sub: 'u1' },
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a second IPD admission for the same patient', async () => {
    const service = Object.create(EmergencyService.prototype) as EmergencyService;
    Object.assign(service, {
      emergencies: {
        findOne: jest.fn().mockResolvedValue({
          id: 'ed-1',
          status: 'active',
          workflowStage: 'treatment',
          encounter: { id: 'enc-1', patient: { id: 'p1' } },
        }),
      },
      inpatientService: {
        findActiveAdmissionForEncounter: jest.fn().mockResolvedValue(null),
        findActiveAdmissionForPatient: jest.fn().mockResolvedValue({
          encounter: { id: 'other-enc' },
        }),
      },
    });

    await expect(
      service.disposition(
        'ed-1',
        { outcome: 'admitted_ipd', bedId: 'bed-1' } as never,
        { user: { sub: 'u1' } } as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
