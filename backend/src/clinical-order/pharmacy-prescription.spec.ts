import {
  dispensedQuantity,
  lineStatus,
  prescribedQuantity,
  prescriptionGroupId,
  remainingQuantity,
} from './pharmacy-prescription';

describe('pharmacy prescription grouping', () => {
  it('uses the order id for legacy single-drug scripts', () => {
    expect(prescriptionGroupId({ id: 'legacy-1', status: 'dispensed', metadata: { medication: 'PARA' } })).toBe(
      'legacy-1',
    );
  });

  it('groups child lines under the prescription header', () => {
    expect(
      prescriptionGroupId({
        id: 'line-1',
        status: 'requested',
        metadata: { kind: 'line', prescriptionGroupId: 'rx-9' },
      }),
    ).toBe('rx-9');
  });

  it('tracks remaining quantity for partial dispensing', () => {
    const order = {
      id: 'line-1',
      status: 'partially_dispensed',
      metadata: { quantityPrescribed: 21, quantityDispensed: 10 },
    };
    expect(prescribedQuantity(order)).toBe(21);
    expect(dispensedQuantity(order)).toBe(10);
    expect(remainingQuantity(order)).toBe(11);
    expect(lineStatus(order)).toBe('partially_dispensed');
  });

  it('does not mark a line dispensed while quantity remains', () => {
    expect(
      lineStatus({
        id: 'line-1',
        status: 'requested',
        metadata: { quantityPrescribed: 20, quantityDispensed: 5 },
      }),
    ).toBe('partially_dispensed');
  });
});
