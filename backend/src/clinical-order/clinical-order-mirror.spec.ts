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
});
