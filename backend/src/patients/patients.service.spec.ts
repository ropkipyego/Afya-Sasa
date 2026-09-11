import { BadRequestException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import type { CreatePatientDto } from './patient.dto';

function serviceStub() {
  return Object.create(PatientsService.prototype) as PatientsService;
}

function adultDto(overrides: Partial<CreatePatientDto> = {}): CreatePatientDto {
  return {
    firstName: 'Jane',
    lastName: 'Wanjiku',
    dateOfBirth: '1990-01-15',
    gender: 'female',
    primaryPhone: '0712345678',
    ...overrides,
  };
}

function minorDto(overrides: Partial<CreatePatientDto> = {}): CreatePatientDto {
  return adultDto({
    firstName: 'Brian',
    lastName: 'Otieno',
    dateOfBirth: '2018-04-02',
    nextOfKin: [
      {
        name: 'Mary Otieno',
        relationship: 'Mother',
        primaryPhone: '0722000111',
      },
    ],
    ...overrides,
  });
}

describe('PatientsService.assertCreateRules', () => {
  const service = serviceStub();

  it('accepts an adult with required demographics', () => {
    expect(() => service.assertCreateRules(adultDto())).not.toThrow();
  });

  it('accepts a minor when guardian details are on the child record', () => {
    expect(() => service.assertCreateRules(minorDto())).not.toThrow();
  });

  it('rejects a minor without guardian name, relationship, and phone', () => {
    expect(() => service.assertCreateRules(minorDto({ nextOfKin: [] }))).toThrow(
      /Guardian name, relationship, and phone/,
    );
    expect(() =>
      service.assertCreateRules(
        minorDto({
          nextOfKin: [{ name: '   ', relationship: 'Mother', primaryPhone: '0722000111' }],
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects blank or whitespace required fields', () => {
    expect(() => service.assertCreateRules(adultDto({ firstName: '   ' }))).toThrow(
      /First name and last name/,
    );
    expect(() => service.assertCreateRules(adultDto({ lastName: '' }))).toThrow(
      /First name and last name/,
    );
    expect(() => service.assertCreateRules(adultDto({ dateOfBirth: '  ' }))).toThrow(
      /Date of birth/,
    );
    expect(() => service.assertCreateRules(adultDto({ primaryPhone: '   ' }))).toThrow(
      /Phone number/,
    );
  });

  it('does not treat name-only as a hard create rule', () => {
    expect(() =>
      service.assertCreateRules(
        adultDto({
          firstName: 'John',
          lastName: 'Mwangi',
          dateOfBirth: '1985-06-01',
          primaryPhone: '0700111222',
        }),
      ),
    ).not.toThrow();
  });
});

function queryBuilder(rows: unknown[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('PatientsService.detectDuplicates', () => {
  it('does not treat name-only as a duplicate', async () => {
    const service = serviceStub();
    Object.assign(service, {
      identifiers: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      },
      patients: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder([])),
      },
    });

    const result = await service.detectDuplicates({
      firstName: 'Jane',
      lastName: 'Wanjiku',
      gender: 'female',
      primaryPhone: '12',
    } as CreatePatientDto);

    expect(result.hasPotentialDuplicate).toBe(false);
    expect(result.matchReasons).not.toContain('name_dob');
  });

  it('warns on first name + last name + date of birth', async () => {
    const existing = {
      id: 'existing-1',
      patientNo: 'JAL-P-2026-0001',
      firstName: 'Jane',
      lastName: 'Wanjiku',
    };
    const service = serviceStub();
    Object.assign(service, {
      identifiers: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      },
      patients: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(queryBuilder([]))
          .mockReturnValueOnce(queryBuilder([existing])),
      },
    });

    const result = await service.detectDuplicates(adultDto());
    expect(result.hasPotentialDuplicate).toBe(true);
    expect(result.matchReasons).toContain('name_dob');
    expect(result.candidates[0].patientNo).toBe('JAL-P-2026-0001');
  });
});

describe('PatientsService identifier and update safety', () => {
  it('hard-blocks a duplicate identifier with the existing MRN', async () => {
    const service = serviceStub();
    Object.assign(service, {
      identifiers: {
        findOne: jest.fn().mockResolvedValue({
          patient: { patientNo: 'JAL-P-2026-0009' },
        }),
      },
    });

    await expect(
      (
        service as unknown as {
          ensureNoDuplicateIdentifier: (rows: { type: string; value: string }[]) => Promise<void>;
        }
      ).ensureNoDuplicateIdentifier([{ type: 'national_id', value: '12345678' }]),
    ).rejects.toThrow(/already exists \(JAL-P-2026-0009\)/);
  });

  it('does not overwrite clinical history when demographics are edited', async () => {
    const service = serviceStub();
    const update = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue({ id: 'p1', firstName: 'Jane' });
    Object.assign(service, {
      findOne,
      patients: { update },
    });

    await service.update(
      'p1',
      {
        firstName: 'Janet',
        allergies: [
          {
            allergen: 'should-not-apply',
            type: 'drug',
            reaction: 'rash',
            severity: 'mild',
          },
        ],
        nextOfKin: [{ name: 'should-not-apply', relationship: 'Mother', primaryPhone: '0700' }],
      },
      { user: { sub: 'actor' } } as never,
    );

    expect(update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        firstName: 'Janet',
        updatedBy: 'actor',
      }),
    );
    expect(update.mock.calls[0][1].allergies).toBeUndefined();
    expect(update.mock.calls[0][1].nextOfKin).toBeUndefined();
  });

  it('rejects a blank demographic edit without clearing the stored record', async () => {
    const service = serviceStub();
    const update = jest.fn();
    Object.assign(service, {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', firstName: 'Jane' }),
      patients: { update },
    });

    await expect(
      service.update('p1', { firstName: '   ' }, { user: { sub: 'actor' } } as never),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps search results free of clinical extras', () => {
    const service = serviceStub();
    const item = (
      service as unknown as {
        toSearchItem: (patient: Record<string, unknown>) => Record<string, unknown>;
      }
    ).toSearchItem({
      id: 'p1',
      patientNo: 'JAL-P-2026-0001',
      firstName: 'Jane',
      middleName: null,
      lastName: 'Wanjiku',
      dateOfBirth: '1990-01-15',
      gender: 'female',
      primaryPhone: '0712345678',
      createdAt: '2026-09-11T00:00:00.000Z',
      identifiers: [{ type: 'national_id', value: '12345678' }],
      allergies: [{ allergen: 'Penicillin' }],
      chronicConditions: [{ name: 'Asthma' }],
    });

    expect(item).toEqual({
      id: 'p1',
      patientNo: 'JAL-P-2026-0001',
      firstName: 'Jane',
      middleName: null,
      lastName: 'Wanjiku',
      dateOfBirth: '1990-01-15',
      gender: 'female',
      primaryPhone: '0712345678',
      createdAt: '2026-09-11T00:00:00.000Z',
      identifiers: [{ type: 'national_id', value: '12345678' }],
    });
    expect(item.allergies).toBeUndefined();
  });
});
