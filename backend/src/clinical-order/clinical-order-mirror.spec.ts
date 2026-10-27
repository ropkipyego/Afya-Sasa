import { ClinicalOrderMirrorService } from './clinical-order-mirror.service';

function serviceWith(mocks: Record<string, unknown>) {
  const service = Object.create(ClinicalOrderMirrorService.prototype) as ClinicalOrderMirrorService;
  Object.assign(service, mocks);
  return service;
}

describe('createPharmacyPrescription catalogue product', () => {
  it('rejects a line without an exact catalogue product id', async () => {
    const service = serviceWith({
      orders: { save: jest.fn(), create: jest.fn(), find: jest.fn(), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: { find: jest.fn() },
    });
    await expect(
      service.createPharmacyPrescription(
        {
          patientId: 'p1',
          lines: [{ medication: 'Paracetamol', quantity: 10 }],
        },
        { user: { sub: 'doc-1' } } as never,
      ),
    ).rejects.toThrow(/exact pharmacy catalogue product/);
    expect(
      (service as unknown as { orders: { save: jest.Mock } }).orders.save,
    ).not.toHaveBeenCalled();
  });

  it('rejects an item id that is not an active pharmaceutical product', async () => {
    const service = serviceWith({
      orders: { save: jest.fn(), create: jest.fn(), find: jest.fn(), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: { find: jest.fn().mockResolvedValue([]) },
    });
    await expect(
      service.createPharmacyPrescription(
        {
          patientId: 'p1',
          lines: [{ medication: 'Paracetamol', quantity: 10, itemId: 'missing-id' }],
        },
        { user: { sub: 'doc-1' } } as never,
      ),
    ).rejects.toThrow(/missing or inactive/);
    expect(
      (service as unknown as { orders: { save: jest.Mock } }).orders.save,
    ).not.toHaveBeenCalled();
  });

  it('accepts multiple lines that each have a valid catalogue id', async () => {
    const create = jest.fn((row: unknown) => row);
    const save = jest.fn(async (row: unknown) => row);
    const service = serviceWith({
      orders: { save, create, find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: {
        find: jest.fn().mockResolvedValue([{ id: 'item-a' }, { id: 'item-b' }]),
      },
    });
    const result = await service.createPharmacyPrescription(
      {
        patientId: 'p1',
        clientRequestId: 'rx-1',
        lines: [
          {
            medication: 'Paracetamol 500mg',
            quantity: 15,
            itemId: 'item-a',
            dose: '500 mg',
            frequency: 'TDS',
            duration: '5 days',
            route: 'oral',
          },
          {
            medication: 'Amoxicillin 250mg',
            quantity: 21,
            itemId: 'item-b',
            dose: '250 mg',
            frequency: 'TDS',
            duration: '7 days',
            route: 'oral',
          },
        ],
      },
      { user: { sub: 'doc-1' } } as never,
    );
    expect(result.lines).toHaveLength(2);
    expect(save).toHaveBeenCalled();
  });

  it('rejects a new prescription that is missing dose, frequency or route', async () => {
    const save = jest.fn();
    const service = serviceWith({
      orders: { save, create: jest.fn(), find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: { find: jest.fn().mockResolvedValue([{ id: 'item-a' }]) },
    });
    await expect(
      service.createPharmacyPrescription(
        {
          patientId: 'p1',
          lines: [{ medication: 'Paracetamol', quantity: 10, itemId: 'item-a', dose: '', frequency: 'TDS', route: 'oral' }],
        },
        { user: { sub: 'doc-1' } } as never,
      ),
    ).rejects.toThrow(/Dose and frequency/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a non-positive quantity', async () => {
    const save = jest.fn();
    const service = serviceWith({
      orders: { save, create: jest.fn(), find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: { find: jest.fn().mockResolvedValue([{ id: 'item-a' }]) },
    });
    await expect(
      service.createPharmacyPrescription(
        {
          patientId: 'p1',
          lines: [
            { medication: 'Paracetamol', quantity: 0, itemId: 'item-a', dose: '500 mg', frequency: 'TDS', route: 'oral' },
          ],
        },
        { user: { sub: 'doc-1' } } as never,
      ),
    ).rejects.toThrow(/positive quantity/);
    expect(save).not.toHaveBeenCalled();
  });

  it('replays a duplicate client request instead of creating a second prescription', async () => {
    const existing = {
      id: 'header-1',
      metadata: { kind: 'prescription', clientRequestId: 'same-click' },
    };
    const save = jest.fn();
    const service = serviceWith({
      orders: {
        save,
        create: jest.fn(),
        query: jest.fn().mockResolvedValue([]),
        find: jest
          .fn()
          .mockResolvedValueOnce([existing])
          .mockResolvedValueOnce([
            existing,
            { id: 'line-1', metadata: { kind: 'line', prescriptionGroupId: 'header-1' } },
          ]),
      },
      inventoryItems: { find: jest.fn().mockResolvedValue([{ id: 'item-a' }]) },
    });
    const result = await service.createPharmacyPrescription(
      {
        patientId: 'p1',
        clientRequestId: 'same-click',
        lines: [{ medication: 'Paracetamol', quantity: 10, itemId: 'item-a' }],
      },
      { user: { sub: 'doc-1' } } as never,
    );
    expect(result).toMatchObject({ replayed: true, header: existing });
    expect(save).not.toHaveBeenCalled();
  });

  it('persists canonical sku, strength, dosageForm and unit on line metadata and medicationSummary on header', async () => {
    const create = jest.fn((row: unknown) => row);
    const save = jest.fn(async (row: unknown) => row);
    const service = serviceWith({
      orders: { save, create, find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: {
        find: jest.fn().mockResolvedValue([
          { id: 'item-a', sku: 'PARA500', name: 'Paracetamol 500mg tablet', strength: '500mg', dosageForm: 'tablet', unit: 'tablet' },
        ]),
      },
    });
    const result = await service.createPharmacyPrescription(
      {
        patientId: 'p1',
        encounterId: 'enc-1',
        lines: [
          {
            medication: 'Paracetamol 500mg tablet',
            quantity: 15,
            itemId: 'item-a',
            dose: '500 mg',
            frequency: 'TDS',
            duration: '5 days',
            route: 'oral',
            instructions: 'Take after meals',
          },
        ],
      },
      { user: { sub: 'doc-1' } } as never,
    );
    expect(result.header.metadata).toMatchObject({
      kind: 'prescription',
      lineCount: 1,
      medicationSummary: 'Paracetamol 500mg tablet (500 mg, qty 15)',
    });
    expect(result.lines[0].metadata).toMatchObject({
      kind: 'line',
      itemId: 'item-a',
      sku: 'PARA500',
      strength: '500mg',
      dosageForm: 'tablet',
      unit: 'tablet',
      quantityPrescribed: 15,
      quantityDispensed: 0,
      instructions: 'Take after meals',
    });
  });

  it('cancels an un-dispensed prescription group and refuses to cancel a dispensed line', async () => {
    const header = {
      id: 'grp-1',
      orderNo: 'RX-100',
      status: 'requested',
      patient: { id: 'p1' },
      metadata: { kind: 'prescription', prescriptionGroupId: 'grp-1' },
    };
    const line1 = {
      id: 'line-1',
      orderNo: 'RX-100-1',
      status: 'requested',
      patient: { id: 'p1' },
      metadata: { kind: 'line', prescriptionGroupId: 'grp-1', quantityPrescribed: 10, quantityDispensed: 0 },
    };
    const save = jest.fn(async (r: unknown) => r);
    const service = serviceWith({
      orders: {
        findOne: jest.fn().mockResolvedValue(header),
        find: jest.fn().mockResolvedValue([header, line1]),
        save,
      },
    });
    const cancelled = await service.cancelPharmacyPrescription('grp-1', 'Changed regimen', {
      user: { sub: 'doc-1' },
    } as never);
    expect(cancelled.cancelled).toBe(2);
    expect(header.status).toBe('cancelled');
    expect(line1.status).toBe('cancelled');

    // Now test refusal when already dispensed
    const dispensedLine = {
      ...line1,
      status: 'partially_dispensed',
      metadata: { ...line1.metadata, quantityDispensed: 5 },
    };
    const serviceDispensed = serviceWith({
      orders: {
        findOne: jest.fn().mockResolvedValue(header),
        find: jest.fn().mockResolvedValue([header, dispensedLine]),
        save: jest.fn(),
      },
    });
    await expect(
      serviceDispensed.cancelPharmacyPrescription('grp-1', 'Attempt erase', { user: { sub: 'doc-1' } } as never),
    ).rejects.toThrow(/already been dispensed/);
  });

  it('rejects inactive medicines, non-pharmaceutical supplies, and restricted formulary medicines for unauthorised roles while preserving unverified vs verified PPB status', async () => {
    const save = jest.fn(async (r: unknown) => r);
    const create = jest.fn((r: unknown) => r);
    const inactiveService = serviceWith({
      orders: { save, create, find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: {
        find: jest.fn().mockResolvedValue([
          { id: 'item-inactive', sku: 'OLD100', name: 'Discontinued Drug', category: 'pharmaceutical', active: false },
        ]),
      },
    });
    await expect(
      inactiveService.createPharmacyPrescription(
        {
          patientId: 'p1',
          lines: [
            { medication: 'Discontinued Drug', itemId: 'item-inactive', dose: '100mg', route: 'oral', frequency: 'OD', quantity: 5 },
          ],
        },
        { user: { sub: 'doc-1', roles: ['doctor'] } } as never,
      ),
    ).rejects.toThrow(/inactive in the hospital formulary/i);

    const supplyService = serviceWith({
      orders: { save, create, find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: {
        find: jest.fn().mockResolvedValue([
          { id: 'item-gloves', sku: 'GLV-M', name: 'Examination Gloves', category: 'medical_consumable', active: true },
        ]),
      },
    });
    await expect(
      supplyService.createPharmacyPrescription(
        {
          patientId: 'p1',
          lines: [
            { medication: 'Examination Gloves', itemId: 'item-gloves', dose: '1 pair', route: 'other', frequency: 'OD', quantity: 2 },
          ],
        },
        { user: { sub: 'doc-1', roles: ['doctor'] } } as never,
      ),
    ).rejects.toThrow(/not a pharmaceutical hospital formulary medicine/i);

    const restrictedItem = {
      id: 'item-mero',
      sku: 'MERO1G',
      name: 'Meropenem 1g injection',
      category: 'pharmaceutical',
      active: true,
      unit: 'vial',
    };
    const restrictedService = serviceWith({
      orders: { save, create, find: jest.fn().mockResolvedValue([]), query: jest.fn().mockResolvedValue([]) },
      inventoryItems: {
        find: jest.fn().mockResolvedValue([restrictedItem]),
      },
    });
    const formularyPolicies = {
      MERO1G: {
        restricted: true,
        restrictionNote: 'Reserve carbapenem — consultant approval required',
        allowedRoles: ['consultant'],
        ppbRegistrationNo: 'PPB-UNVERIFIED-99',
        ppbVerified: false,
      },
    };

    // Regular doctor blocked from restricted medicine
    await expect(
      restrictedService.createPharmacyPrescription(
        {
          patientId: 'p1',
          formularyPolicies,
          lines: [
            { medication: 'Meropenem 1g injection', itemId: 'item-mero', dose: '1g', route: 'iv', frequency: 'TDS', quantity: 6 },
          ],
        },
        { user: { sub: 'doc-1', roles: ['doctor'], permissions: ['pharmacy:prescribe'] } } as never,
      ),
    ).rejects.toThrow(/restricted under hospital formulary policy/i);

    // Consultant allowed; regulatoryStatus remains unverified because ppbVerified is false
    const allowedRes = await restrictedService.createPharmacyPrescription(
      {
        patientId: 'p1',
        formularyPolicies,
        lines: [
          { medication: 'Meropenem 1g injection', itemId: 'item-mero', dose: '1g', route: 'iv', frequency: 'TDS', quantity: 6 },
        ],
      },
      { user: { sub: 'cons-1', roles: ['consultant'], permissions: ['pharmacy:prescribe'] } } as never,
    );
    expect(allowedRes.lines[0].metadata).toMatchObject({
      formularyStatus: 'hospital_formulary',
      prescribingStatus: 'restricted_formulary_item',
      regulatoryStatus: 'regulatory_status_unverified',
      ppbRegistrationNo: null,
    });
  });
});
