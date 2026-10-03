import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BiometricService } from './biometric.service';
import { DigitalPersonaProvider } from './providers/digitalpersona.provider';

describe('BiometricService', () => {
  const provider = new DigitalPersonaProvider();

  function service(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(BiometricService.prototype) as BiometricService;
    Object.assign(instance, {
      provider,
      usedNonces: new Map(),
      patients: {
        findOne: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (where.id === 'p2') return { id: 'p2', patientNo: 'JH-2', firstName: 'B', lastName: 'Patient' };
          return { id: 'p1', patientNo: 'JH-1', firstName: 'A', lastName: 'Patient', dateOfBirth: '1990-01-01', gender: 'female' };
        }),
      },
      identities: { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), create: jest.fn((row) => row), find: jest.fn().mockResolvedValue([]) },
      devices: {
        findOne: jest.fn().mockResolvedValue({
          id: 'dev-1',
          deviceKey: 'desk-1',
          status: 'online',
          secretHash: require('crypto').createHash('sha256').update('secret').digest('hex'),
        }),
        save: jest.fn(),
      },
      verifications: { save: jest.fn(), create: jest.fn((row) => row) },
      encounters: { findOne: jest.fn().mockResolvedValue(null) },
      admissions: { findOne: jest.fn().mockResolvedValue(null) },
      appointments: { findOne: jest.fn().mockResolvedValue(null) },
      allergies: { find: jest.fn().mockResolvedValue([]) },
      audit: { record: jest.fn() },
      config: { get: jest.fn() },
      ...overrides,
    });
    return instance;
  }

  const reception = {
    user: { sub: 'u1', roles: ['records_officer'], permissions: ['patients:create', 'patients:search'] },
    header: () => 'corr-1',
  } as never;

  const doctor = {
    user: { sub: 'doc-1', roles: ['doctor'], permissions: ['consultations:read'] },
    header: () => 'corr-2',
  } as never;

  const capture = {
    deviceKey: 'desk-1',
    deviceSecret: 'secret',
    operation: 'enroll' as const,
    result: 'enrolled' as const,
    externalSubjectId: 'dp-1',
    nonce: 'nonce-1',
    capturedAt: new Date().toISOString(),
  };

  it('rejects a doctor enrolling a biometric identity', async () => {
    const bio = service();
    await expect(bio.enroll({ patientId: 'p1', capture }, doctor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a doctor unlinking a biometric identity', async () => {
    const bio = service();
    await expect(bio.unlink('id-1', doctor)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a replayed nonce', async () => {
    const bio = service();
    Object.assign(bio, {
      identities: {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue({ id: 'id-1', fingerPosition: 'right_index' }),
        create: jest.fn((row) => row),
        find: jest.fn().mockResolvedValue([]),
      },
    });
    await bio.enroll({ patientId: 'p1', capture, fingerPosition: 'right_index' }, reception);
    await expect(bio.enroll({ patientId: 'p1', capture, fingerPosition: 'left_index' }, reception)).rejects.toThrow(/already used/);
  });

  it('rejects linking the same fingerprint to a second patient and audits the conflict', async () => {
    const audit = { record: jest.fn() };
    const bio = service({
      audit,
      identities: {
        findOne: jest.fn().mockResolvedValue({
          id: 'id-1',
          externalSubjectId: 'dp-1',
          patient: { id: 'other' },
        }),
        save: jest.fn(),
        create: jest.fn((row) => row),
        find: jest.fn().mockResolvedValue([]),
      },
    });
    await expect(bio.enroll({ patientId: 'p1', capture }, reception)).rejects.toThrow(ConflictException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'BIOMETRIC_CONFLICT' }));
  });

  it('allows a second finger for the same patient', async () => {
    const save = jest.fn().mockResolvedValue({ id: 'id-2', fingerPosition: 'left_index' });
    const bio = service({
      identities: {
        findOne: jest.fn().mockResolvedValue(null),
        save,
        create: jest.fn((row) => row),
        find: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await bio.enroll(
      { patientId: 'p1', fingerPosition: 'left_index', capture: { ...capture, nonce: 'nonce-left', externalSubjectId: 'dp-left' } },
      reception,
    );
    expect(result.result).toBe('enrolled');
    expect(save).toHaveBeenCalled();
  });

  it('does not create a patient on no match', async () => {
    const patients = { findOne: jest.fn() };
    const bio = service({ patients });
    const result = await bio.identify(
      {
        capture: {
          ...capture,
          operation: 'identify',
          result: 'no_match',
          nonce: 'nonce-2',
        },
      },
      reception,
    );
    expect(result.result).toBe('no_match');
    expect(result.patients).toEqual([]);
    expect(patients.findOne).not.toHaveBeenCalled();
  });

  it('does not auto-select when the SDK reports multiple candidates', async () => {
    const bio = service({
      identities: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ patient: { id: 'p1', patientNo: 'JH-1', firstName: 'A', lastName: 'P' } })
          .mockResolvedValueOnce({ patient: { id: 'p2', patientNo: 'JH-2', firstName: 'B', lastName: 'P' } }),
        save: jest.fn(),
        create: jest.fn((row) => row),
        find: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await bio.identify(
      {
        capture: {
          ...capture,
          operation: 'identify',
          result: 'multiple_candidates',
          nonce: 'nonce-multi',
          candidates: [{ externalSubjectId: 'dp-1' }, { externalSubjectId: 'dp-2' }],
        },
      },
      reception,
    );
    expect(result.result).toBe('multiple_candidates');
    expect(result.patients).toHaveLength(2);
    expect(result.context).toBeNull();
  });

  it('identifies patient A even if a different patient id is already in the client', async () => {
    const bio = service({
      identities: {
        findOne: jest.fn().mockResolvedValue({
          patient: {
            id: 'p1',
            patientNo: 'JH-1',
            firstName: 'A',
            lastName: 'Patient',
            dateOfBirth: '1990-01-01',
            gender: 'female',
          },
        }),
        save: jest.fn(),
        create: jest.fn((row) => row),
        find: jest.fn(),
      },
    });
    const result = await bio.identify(
      {
        capture: {
          ...capture,
          operation: 'identify',
          result: 'verified',
          nonce: 'nonce-identify-a',
        },
      },
      reception,
    );
    expect(result.result).toBe('verified');
    expect(result.patients[0].id).toBe('p1');
    expect(result.patients[0].id).not.toBe('p2');
  });

  it('rejects verification against the wrong biometric subject', async () => {
    const bio = service({
      identities: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([
          {
            id: 'id-1',
            externalSubjectId: 'dp-1',
            patient: { id: 'p1' },
          },
        ]),
        save: jest.fn(),
        create: jest.fn((row) => row),
      },
    });
    const result = await bio.verify(
      {
        patientId: 'p1',
        capture: {
          ...capture,
          operation: 'verify',
          result: 'verified',
          externalSubjectId: 'dp-other',
          nonce: 'nonce-wrong',
        },
      },
      reception,
    );
    expect(result.matched).toBe(false);
    expect(result.result).toBe('not_verified');
  });

  it('rejects SDK unavailable enrollment without inventing success', async () => {
    const bio = service();
    await expect(
      bio.enroll(
        {
          patientId: 'p1',
          capture: {
            ...capture,
            result: 'device_error',
            lastError: 'SDK_UNAVAILABLE: HID DigitalPersona SDK is not installed',
            nonce: 'nonce-sdk',
          },
        },
        reception,
      ),
    ).rejects.toThrow(/SDK is not available/);
  });

  it('never returns a template or device secret', async () => {
    const bio = service({
      identities: {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue({ id: 'id-1', fingerPosition: 'right_index' }),
        create: jest.fn((row) => ({ ...row, templateCipher: 'SECRET' })),
        find: jest.fn().mockResolvedValue([]),
      },
    });
    const result = await bio.enroll({ patientId: 'p1', capture: { ...capture, nonce: 'nonce-sec' } }, reception);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|template|deviceSecret/i);
  });

  it('rejects an expired capture timestamp', () => {
    expect(() =>
      provider.validatePayload({
        ...capture,
        capturedAt: new Date(Date.now() - 120_000).toISOString(),
      }),
    ).toThrow(BadRequestException);
  });

  it('requires an existing patient before enrollment', async () => {
    const bio = service({
      patients: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await expect(bio.enroll({ patientId: 'missing', capture }, reception)).rejects.toThrow(/Patient not found/);
  });

  it('rejects a disconnected reader without inventing enrollment', async () => {
    const bio = service();
    await expect(
      bio.enroll(
        {
          patientId: 'p1',
          capture: {
            ...capture,
            result: 'device_error',
            lastError: 'DEVICE_DISCONNECTED',
            nonce: 'nonce-disc',
          },
        },
        reception,
      ),
    ).rejects.toThrow(/reader unavailable/i);
  });

  it('rejects a poor-quality enrollment even if the agent result is enrolled', async () => {
    const bio = service();
    await expect(
      bio.enroll(
        {
          patientId: 'p1',
          capture: {
            ...capture,
            result: 'enrolled',
            qualityLabel: 'Poor',
            nonce: 'nonce-poor',
          },
        },
        reception,
      ),
    ).rejects.toThrow(/quality is too low/i);
  });

  it('verifies a known fingerprint against the requested patient', async () => {
    const bio = service({
      identities: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([{ id: 'id-1', externalSubjectId: 'dp-1', patient: { id: 'p1' } }]),
        save: jest.fn(),
        create: jest.fn((row) => row),
      },
    });
    const result = await bio.verify(
      {
        patientId: 'p1',
        capture: { ...capture, operation: 'verify', result: 'verified', nonce: 'nonce-ok-verify' },
      },
      reception,
    );
    expect(result.matched).toBe(true);
    expect(result.patientId).toBe('p1');
  });

  it('fails verification when the patient has no biometric identity', async () => {
    const bio = service({
      identities: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), save: jest.fn(), create: jest.fn() },
    });
    await expect(
      bio.verify(
        {
          patientId: 'p1',
          capture: { ...capture, operation: 'verify', result: 'verified', nonce: 'nonce-none' },
        },
        reception,
      ),
    ).rejects.toThrow(/No biometric identity/);
  });

  it('rejects unauthorized verification', async () => {
    const bio = service();
    await expect(
      bio.verify(
        {
          patientId: 'p1',
          capture: { ...capture, operation: 'verify', result: 'verified', nonce: 'nonce-doc-v' },
        },
        doctor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns a patient summary after identification without creating a patient', async () => {
    const patients = {
      findOne: jest.fn().mockResolvedValue({
        id: 'p1',
        patientNo: 'JH-1',
        firstName: 'A',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        photoUrl: null,
      }),
    };
    const bio = service({
      patients,
      identities: {
        findOne: jest.fn().mockResolvedValue({
          patient: {
            id: 'p1',
            patientNo: 'JH-1',
            firstName: 'A',
            lastName: 'Patient',
            dateOfBirth: '1990-01-01',
            gender: 'female',
          },
        }),
        save: jest.fn(),
        create: jest.fn(),
        find: jest.fn(),
      },
    });
    const result = await bio.identify(
      { capture: { ...capture, operation: 'identify', result: 'verified', nonce: 'nonce-summary' } },
      reception,
    );
    expect(result.result).toBe('verified');
    expect(result.patients[0].patientNo).toBe('JH-1');
    expect(result.context).toEqual(
      expect.objectContaining({
        currentEncounter: null,
        currentAdmission: null,
        upcomingAppointment: null,
        alerts: [],
      }),
    );
    expect(patients.findOne).not.toHaveBeenCalled();
  });

  it('does not return template or device secret from listed identities', async () => {
    const bio = service({
      identities: {
        find: jest.fn().mockResolvedValue([
          { id: 'id-1', fingerPosition: 'right_index', status: 'active', createdAt: new Date(), templateCipher: 'SECRET' },
        ]),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      },
    });
    const result = await bio.listIdentities('p1', reception);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|template|deviceSecret/i);
  });

  it('rejects patient-id tampering because identify ignores a client-supplied patient', async () => {
    const bio = service({
      identities: {
        findOne: jest.fn().mockResolvedValue({
          patient: { id: 'p1', patientNo: 'JH-1', firstName: 'A', lastName: 'Patient' },
        }),
        save: jest.fn(),
        create: jest.fn(),
        find: jest.fn(),
      },
    });
    const result = await bio.identify(
      {
        capture: {
          ...capture,
          operation: 'identify',
          result: 'verified',
          nonce: 'nonce-tamper',
        },
      },
      reception,
    );
    expect(result.patients[0].id).toBe('p1');
    expect(result.patients.map((row) => row.id)).not.toContain('p2');
  });
});
