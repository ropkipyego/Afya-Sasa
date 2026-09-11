import { NotFoundException } from '@nestjs/common';
import { Not } from 'typeorm';
import { InpatientService } from './inpatient.service';

describe('InpatientService clinical correctness', () => {
  it('returns cancelled admissions to open care instead of leaving the encounter admitted', async () => {
    const service = Object.create(InpatientService.prototype) as InpatientService;
    const encounterUpdate = jest.fn();
    const investigationOutstanding = jest.fn().mockResolvedValue({
      openLab: 0,
      openRad: 0,
      unreviewedLab: 0,
      unreviewedRad: 0,
      unreviewedCritical: 0,
    });
    Object.assign(service, {
      getAdmission: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'adm-1',
          status: 'active',
          bed: { id: 'bed-1', version: 1 },
          encounter: { id: 'enc-1', status: 'admitted' },
        })
        .mockResolvedValueOnce({ id: 'adm-1', status: 'cancelled' }),
      admissions: { findOne: jest.fn().mockResolvedValue(null) },
      encounterWorkflow: { investigationOutstanding },
      dataSource: {
        transaction: jest.fn(async (fn: (manager: unknown) => Promise<void>) =>
          fn({
            getRepository: (entity: { name?: string }) => {
              if (entity.name === 'Encounter') {
                return { update: encounterUpdate };
              }
              return { update: jest.fn() };
            },
          }),
        ),
      },
      realtime: { publish: jest.fn() },
    });

    await service.cancelAdmission('adm-1', { user: { sub: 'u1' } } as never);

    expect(encounterUpdate).toHaveBeenCalledWith('enc-1', {
      status: 'in_consultation',
      endedAt: null,
      updatedBy: 'u1',
    });
  });

  it('returns a cancelled admission to awaiting results when investigations are still open', async () => {
    const service = Object.create(InpatientService.prototype) as InpatientService;
    Object.assign(service, {
      admissions: { findOne: jest.fn().mockResolvedValue(null) },
      encounterWorkflow: {
        investigationOutstanding: jest.fn().mockResolvedValue({
          openLab: 1,
          openRad: 0,
          unreviewedLab: 0,
          unreviewedRad: 0,
          unreviewedCritical: 0,
        }),
      },
    });

    const restore = await (
      service as unknown as {
        encounterStatusAfterCancelledAdmission: (admission: {
          id: string;
          encounter: { id: string; status: string };
        }) => Promise<{ status: string } | null>;
      }
    ).encounterStatusAfterCancelledAdmission({
      id: 'adm-1',
      encounter: { id: 'enc-1', status: 'admitted' },
    });

    expect(restore).toEqual({ encounterId: 'enc-1', status: 'awaiting_results' });
    expect(service['admissions'].findOne).toHaveBeenCalledWith({
      where: {
        id: Not('adm-1'),
        encounter: { id: 'enc-1' },
        status: 'active',
      },
    });
  });

  it('does not complete or invent an encounter when the cancelled admission has none', async () => {
    const service = Object.create(InpatientService.prototype) as InpatientService;
    const restore = await (
      service as unknown as {
        encounterStatusAfterCancelledAdmission: (admission: {
          id: string;
          encounter: null;
        }) => Promise<unknown>;
      }
    ).encounterStatusAfterCancelledAdmission({
      id: 'adm-1',
      encounter: null,
    });
    expect(restore).toBeNull();
  });

  it('prints only a completed discharge summary', async () => {
    const service = Object.create(InpatientService.prototype) as InpatientService;
    const findOne = jest.fn().mockResolvedValue({
      presentingComplaint: 'Cough',
      history: 'Draft history',
      examOnAdmission: 'NAD',
      investigationsSummary: 'None',
      finalDiagnosis: 'URI',
      treatmentGiven: 'Supportive',
      dischargeMeds: 'None',
      followUpInstructions: 'Review',
    });
    Object.assign(service, {
      getAdmission: jest.fn().mockResolvedValue({
        admissionNo: 'ADM-1',
        status: 'discharged',
        admittedAt: new Date('2026-09-01'),
        ward: { name: 'HDU' },
        bed: { bedNo: 'HDU-01' },
        patient: { firstName: 'Test', lastName: 'Patient', patientNo: 'JH-TEST' },
      }),
      summaries: { findOne },
    });

    await service.dischargeSummaryPdf('adm-1');

    expect(findOne).toHaveBeenCalledWith({
      where: { admission: { id: 'adm-1' }, status: 'complete' },
      order: { createdAt: 'DESC' },
    });
  });

  it('refuses a discharge PDF when only a draft summary exists', async () => {
    const service = Object.create(InpatientService.prototype) as InpatientService;
    Object.assign(service, {
      getAdmission: jest.fn().mockResolvedValue({
        admissionNo: 'ADM-1',
        patient: { firstName: 'Test', lastName: 'Patient', patientNo: 'JH-TEST' },
      }),
      summaries: { findOne: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.dischargeSummaryPdf('adm-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.dischargeSummaryPdf('adm-1')).rejects.toThrow(/completed discharge summary/i);
  });
});
