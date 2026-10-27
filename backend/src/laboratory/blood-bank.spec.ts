import { BloodBankService } from './blood-bank.service';

describe('laboratory blood bank', () => {
  it('refuses to use pharmacy inventory lots', async () => {
    const service = Object.create(BloodBankService.prototype) as BloodBankService;
    Object.assign(service, {
      requests: {
        query: jest.fn().mockResolvedValue([{ table_name: 'blood_bank_requests' }]),
        save: jest.fn(async (row: unknown) => row),
        create: jest.fn((row: unknown) => row),
      },
      units: { query: jest.fn().mockResolvedValue([]) },
    });
    const created = await service.create(
      {
        patientId: 'p1',
        product: 'packed_red_cells',
        units: 1,
        indication: 'Anaemia',
      },
      { user: { sub: 'lab-1' } } as never,
    );
    expect(created).toMatchObject({ product: 'packed_red_cells', status: 'requested' });
    expect(JSON.stringify(created)).not.toMatch(/inventory/);
  });

  it('does not invent a unit ledger when the units table is absent', async () => {
    const service = Object.create(BloodBankService.prototype) as BloodBankService;
    Object.assign(service, {
      requests: {
        query: jest.fn().mockImplementation(async (_sql: string, params?: string[]) => {
          if (params?.[0] === 'blood_bank_units') return [];
          return [{ table_name: 'blood_bank_requests' }];
        }),
        find: jest.fn().mockResolvedValue([]),
      },
    });
    const stock = await service.stock('2026-10-01', '2026-10-20');
    expect(stock.available).toBe(false);
    expect(stock.reason).toMatch(/not on this database/);
    expect(stock).not.toMatchObject({ availableForIssue: 0 });
  });

  it('rejects a second issue of the same request', async () => {
    const service = Object.create(BloodBankService.prototype) as BloodBankService;
    Object.assign(service, {
      requests: {
        manager: {
          transaction: async (fn: (manager: { getRepository: () => unknown }) => Promise<unknown>) =>
            fn({
              getRepository: () => ({
                findOne: async () => ({
                  id: 'bb-1',
                  status: 'issued',
                  groupingResult: 'O+',
                  crossmatchResult: 'compatible',
                }),
                save: jest.fn(),
              }),
            }),
        },
      },
    });
    await expect(
      service.updateStatus(
        'bb-1',
        { status: 'issued' },
        { user: { sub: 'lab-1', permissions: ['lab_results:verify'] } } as never,
      ),
    ).rejects.toThrow(/already in that status/);
  });

  it('blocks request issue when physical units exist but none are reserved', async () => {
    const service = Object.create(BloodBankService.prototype) as BloodBankService;
    Object.assign(service, {
      unitsTableReadyCache: true,
      requests: {
        manager: {
          transaction: async (fn: (manager: { getRepository: () => unknown }) => Promise<unknown>) =>
            fn({
              getRepository: () => ({
                findOne: async () => ({
                  id: 'bb-1',
                  status: 'crossmatched',
                  units: '1',
                  groupingResult: 'O+',
                  crossmatchResult: 'compatible',
                }),
                save: jest.fn(async (row: unknown) => row),
                find: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(2),
              }),
            }),
        },
      },
    });
    await expect(
      service.updateStatus(
        'bb-1',
        { status: 'issued' },
        { user: { sub: 'lab-1', permissions: ['lab_results:verify'] } } as never,
      ),
    ).rejects.toThrow(/Reserve at least one screened unit/);
  });

  it('rejects an unknown blood product', async () => {
    const service = Object.create(BloodBankService.prototype) as BloodBankService;
    Object.assign(service, {
      requests: { query: jest.fn().mockResolvedValue([{ table_name: 'blood_bank_requests' }]) },
    });
    await expect(
      service.create(
        { patientId: 'p1', product: 'paracetamol' as never, units: 1 },
        { user: { sub: 'lab-1' } } as never,
      ),
    ).rejects.toThrow(/blood product/);
  });
})
