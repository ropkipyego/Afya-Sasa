import { BadRequestException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';
import { flagResult, mapFlagToLegacyResultFlag } from './lab-result-engine';

describe('LaboratoryService result safety', () => {
  const operator = { user: { sub: 'lab-1' } } as never;
  const adultMale = {
    gender: 'male',
    dateOfBirth: '1990-01-01',
  };

  function panelItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'item-1',
      request: { id: 'req-1', status: 'processing', patient: adultMale },
      orderableTest: {
        id: 'ot-1',
        code: 'CBC-ESR',
        name: 'CBC + ESR',
        parameters: [
          {
            id: 'p-wbc',
            code: 'WBC',
            unit: 'x10^9/L',
            referenceRanges: [{ gender: 'ALL', rangeLow: '4', rangeHigh: '11' }],
          },
        ],
      },
      ...overrides,
    };
  }

  function service(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(LaboratoryService.prototype) as LaboratoryService;
    Object.assign(instance, {
      items: {
        findOne: jest.fn().mockResolvedValue(panelItem()),
        update: jest.fn(),
      },
      results: {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (row) => ({ id: 'res-1', ...row })),
        create: jest.fn((row) => row),
        createQueryBuilder: jest.fn(),
      },
      samples: { findOne: jest.fn().mockResolvedValue(null) },
      requests: {
        findOne: jest.fn().mockResolvedValue({ id: 'req-1', status: 'processing' }),
        update: jest.fn(),
      },
      catalogService: {
        evaluateResults: jest.fn().mockResolvedValue({
          derived: [],
          flagged: [
            {
              parameterCode: 'WBC',
              flag: 'NORMAL',
              referenceRangeLabel: '4-11',
            },
          ],
        }),
      },
      notifications: { notifyInvestigationStakeholders: jest.fn(), investigationRecipients: jest.fn() },
      ...overrides,
    });
    return instance;
  }

  it('rejects overwriting a verified panel through the service', async () => {
    const lab = service({
      items: {
        findOne: jest.fn().mockResolvedValue(panelItem({ request: { id: 'req-1', status: 'verified', patient: adultMale } })),
        update: jest.fn(),
      },
    });
    await expect(
      lab.enterPanelResults({ requestItemId: 'item-1', results: [{ parameterCode: 'WBC', value: '7' }] }, operator),
    ).rejects.toThrow(BadRequestException);
    expect((lab as never as { results: { save: jest.Mock } }).results.save).not.toHaveBeenCalled();
  });

  it('rejects panel edits when a verified result row already exists', async () => {
    const lab = service({
      results: {
        findOne: jest.fn().mockResolvedValue({ id: 'res-1', verifiedAt: new Date() }),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      },
    });
    await expect(
      lab.enterPanelResults({ requestItemId: 'item-1', results: [{ parameterCode: 'WBC', value: '9' }] }, operator),
    ).rejects.toThrow(/verified result already exists/);
  });

  it('still saves a draft panel when the request is not verified and a range applies', async () => {
    const save = jest.fn().mockImplementation(async (row) => ({ id: 'res-1', ...row }));
    const lab = service({
      results: {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        save,
        create: jest.fn((row) => row),
      },
    });
    const result = await lab.enterPanelResults(
      { requestItemId: 'item-1', results: [{ parameterCode: 'WBC', value: '7' }] },
      operator,
    );
    expect(save).toHaveBeenCalled();
    expect(result.saved[0].flag).toBe('normal');
    expect(result.saved[0].value).toBe('7');
  });

  it('persists unassessed rather than normal when evaluation has no applicable range', async () => {
    const save = jest.fn().mockImplementation(async (row) => ({ id: 'res-1', ...row }));
    const lab = service({
      catalogService: {
        evaluateResults: jest.fn().mockResolvedValue({
          derived: [],
          flagged: [
            {
              parameterCode: 'WBC',
              flag: 'UNASSESSED',
              referenceRangeLabel: 'Not established',
            },
          ],
        }),
      },
      results: {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        save,
        create: jest.fn((row) => row),
      },
    });
    const result = await lab.enterPanelResults(
      { requestItemId: 'item-1', results: [{ parameterCode: 'WBC', value: '7' }] },
      operator,
    );
    expect(result.saved[0].flag).toBe('unassessed');
    expect(result.saved[0].flag).not.toBe('normal');
    expect(result.saved[0].referenceRange).toBe('Not established');
  });
});

describe('preview and persisted flag mapping stay consistent', () => {
  it('maps the same UNASSESSED preview flag that would be stored', () => {
    const preview = flagResult(14, [], { gender: 'M', ageDays: 12000 });
    expect(preview.flag).toBe('UNASSESSED');
    expect(mapFlagToLegacyResultFlag(preview.flag)).toBe('unassessed');
  });

  it('maps the same NORMAL preview flag that would be stored', () => {
    const preview = flagResult(7, [{ gender: 'ALL', rangeLow: 4, rangeHigh: 11 }], {
      gender: 'M',
      ageDays: 12000,
    });
    expect(preview.flag).toBe('NORMAL');
    expect(mapFlagToLegacyResultFlag(preview.flag)).toBe('normal');
  });
});

describe('clinician laboratory inbox', () => {
  it('loads only rows with verified_at set', async () => {
    const where = jest.fn().mockReturnThis();
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where,
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const lab = Object.create(LaboratoryService.prototype) as LaboratoryService;
    Object.assign(lab, {
      results: { createQueryBuilder: jest.fn().mockReturnValue(qb) },
    });
    await lab.resultsInbox();
    expect(where).toHaveBeenCalledWith('result.verified_at IS NOT NULL');
  });
});
