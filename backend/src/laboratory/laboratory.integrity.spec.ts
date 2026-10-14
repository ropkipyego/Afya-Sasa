import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';
import { buildStructuredLabReportHtml } from './lab-report.builder';
import { mapFlagToLegacyResultFlag, pickReferenceRange } from './lab-result-engine';

describe('laboratory integrity programme', () => {
  const operator = { user: { sub: 'lab-1' }, originalUrl: '/laboratory', ip: '127.0.0.1' } as never;

  function service(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(LaboratoryService.prototype) as LaboratoryService;
    Object.assign(instance, {
      config: { get: jest.fn().mockReturnValue(undefined) },
      audit: { record: jest.fn() },
      requests: {
        findOne: jest.fn().mockResolvedValue({ id: 'req-1', status: 'resulted' }),
        update: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
      items: { update: jest.fn(), find: jest.fn().mockResolvedValue([]) },
      results: {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn((row) => row),
        createQueryBuilder: jest.fn(),
      },
      samples: {
        findOne: jest.fn().mockResolvedValue({
          id: 's1',
          request: { id: 'req-1', status: 'sample_collected' },
        }),
        update: jest.fn(),
        findOneOrFail: jest.fn().mockResolvedValue({ id: 's1', condition: 'haemolysed' }),
      },
      ...overrides,
    });
    return instance;
  }

  it('does not assume adequate when receiving a specimen', async () => {
    const lab = service();
    await expect(lab.receiveSample('s1', { condition: 'haemolysed' }, operator)).rejects.toThrow(
      /rejection reason/i,
    );
    expect((lab as never as { samples: { update: jest.Mock } }).samples.update).not.toHaveBeenCalled();
  });

  it('records rejection reason and does not advance a rejected specimen to processing', async () => {
    const lab = service();
    await lab.receiveSample(
      's1',
      { condition: 'haemolysed', rejectionReason: 'Gross haemolysis' },
      operator,
    );
    expect((lab as never as { samples: { update: jest.Mock } }).samples.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ condition: 'haemolysed', rejectionReason: 'Gross haemolysis' }),
    );
    expect((lab as never as { requests: { update: jest.Mock } }).requests.update).not.toHaveBeenCalled();
  });

  it('refuses PDF-only verification when no structured results exist', async () => {
    const lab = service({
      requests: {
        findOne: jest.fn().mockResolvedValue({
          id: 'req-1',
          status: 'processing',
          patient: { firstName: 'A', lastName: 'B' },
        }),
      },
      items: {
        find: jest.fn().mockResolvedValue([{ id: 'item-1', orderableTest: null }]),
        update: jest.fn(),
      },
      results: { find: jest.fn().mockResolvedValue([]) },
    });
    await expect(lab.verifyRequest('req-1', operator)).rejects.toThrow(/PDF attachment is not a substitute/);
  });

  it('keeps amendment disabled until configuration is approved', async () => {
    const lab = service();
    await expect(
      lab.amendResult(
        'res-1',
        { value: '8', reason: 'Clerical' },
        { user: { sub: 'lab-1', permissions: ['lab_results:amend'] } } as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies amendment without lab_results:amend even if the flag is on', async () => {
    const lab = service({ config: { get: jest.fn().mockReturnValue('true') } });
    await expect(
      lab.amendResult('res-1', { value: '8', reason: 'Clerical' }, operator),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a cancellation reason and blocks cancel after verification', async () => {
    const lab = service({
      requests: { findOne: jest.fn().mockResolvedValue({ id: 'req-1', status: 'verified' }) },
    });
    await expect(
      lab.cancelRequest(
        'req-1',
        { reason: 'Duplicate' },
        { user: { sub: 'lab-1', permissions: ['lab_requests:cancel'] } } as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('denies cancellation without lab_requests:cancel', async () => {
    const lab = service();
    await expect(lab.cancelRequest('req-1', { reason: 'Duplicate' }, operator)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuses a second active result for the same parameter', async () => {
    const lab = service({
      items: {
        findOne: jest.fn().mockResolvedValue({
          id: 'item-1',
          request: { id: 'req-1', status: 'processing', patient: { gender: 'male', dateOfBirth: '1990-01-01' } },
          orderableTest: {
            code: 'CBC',
            parameters: [{ id: 'p-wbc', code: 'WBC', unit: 'x10^9/L', referenceRanges: [] }],
          },
        }),
        update: jest.fn(),
      },
      catalogService: {
        evaluateResults: jest.fn().mockResolvedValue({ derived: [], flagged: [] }),
      },
      results: {
        find: jest.fn().mockResolvedValue([
          { id: 'a', parameter: { id: 'p-wbc' }, supersedesId: null, verifiedAt: null },
          { id: 'b', parameter: { id: 'p-wbc' }, supersedesId: null, verifiedAt: null },
        ]),
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
        create: jest.fn((row) => row),
      },
      requests: { findOne: jest.fn(), update: jest.fn() },
    });
    await expect(
      lab.enterResult({ requestItemId: 'item-1', parameterCode: 'WBC', value: '7' }, operator),
    ).rejects.toThrow(/duplicate audit/i);
    expect((lab as never as { results: { save: jest.Mock } }).results.save).not.toHaveBeenCalled();
  });

  it('returns unassessed for unsupported catalog flags', () => {
    expect(mapFlagToLegacyResultFlag('WEIRD')).toBe('unassessed');
    expect(mapFlagToLegacyResultFlag('WEIRD')).not.toBe('normal');
  });

  it('does not pick the first overlapping range when bounds differ', () => {
    const chosen = pickReferenceRange(
      [
        { gender: 'ALL', rangeLow: 4, rangeHigh: 11 },
        { gender: 'ALL', rangeLow: 3, rangeHigh: 12 },
      ],
      { gender: 'M', ageDays: 12000 },
    );
    expect(chosen).toBeNull();
  });

  it('renders unassessed wording and omits superseded originals from the current table', () => {
    const html = buildStructuredLabReportHtml(
      {
        requestNo: 'JH-LAB-9',
        status: 'verified',
        patient: { firstName: 'Test', lastName: 'Patient', patientNo: 'SYN-1', gender: 'unknown' },
        items: [
          {
            orderableTest: { name: 'WBC' },
            results: [
              {
                id: 'old',
                value: '3',
                flag: 'low',
                referenceRange: '4-11',
                verifiedAt: new Date(),
              },
              {
                id: 'new',
                value: '7',
                flag: 'unassessed',
                referenceRange: 'Not established',
                supersedesId: 'old',
                amendmentReason: 'Clerical',
                verifiedAt: null,
              },
            ],
          },
        ],
        samples: [{ barcode: 'SYN-SMP', type: 'blood', condition: 'adequate' }],
      } as never,
      { facilityName: 'Jalaram St. Christopher Hospital' },
    );
    expect(html).toContain('No reference interval');
    expect(html).toContain('not a normal result');
    expect(html).toContain('7');
    expect(html).not.toContain('>3<');
    expect(html).toContain('SYN-1');
  });
});
