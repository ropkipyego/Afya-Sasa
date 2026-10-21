import { lineValidationError, suggestDispenseQuantity } from './prescription-quantity';

describe('safe prescription quantity suggestion', () => {
  it('calculates countable oral tablets', () => {
    expect(
      suggestDispenseQuantity({
        route: 'oral',
        unit: 'tablet',
        frequency: 'TDS',
        duration: '5 days',
        unitsPerAdmin: '1',
      }),
    ).toEqual({ calculable: true, quantity: 15, reason: '1 × 3/day × 5 days' })
  })

  it('does not invent a quantity for injections or liquids', () => {
    expect(
      suggestDispenseQuantity({
        route: 'iv',
        unit: 'vial',
        frequency: 'OD',
        duration: '3 days',
        unitsPerAdmin: '1',
      }).calculable,
    ).toBe(false)
    expect(
      suggestDispenseQuantity({
        route: 'oral',
        unit: 'ml',
        frequency: 'TDS',
        duration: '5 days',
        unitsPerAdmin: '5',
      }).calculable,
    ).toBe(false)
  })

  it('does not calculate PRN, tapering or incomplete instructions', () => {
    expect(
      suggestDispenseQuantity({
        route: 'oral',
        unit: 'tablet',
        frequency: 'PRN',
        duration: '5 days',
        unitsPerAdmin: '1',
      }).calculable,
    ).toBe(false)
    expect(
      suggestDispenseQuantity({
        route: 'oral',
        unit: 'tablet',
        frequency: 'TDS',
        duration: '',
        unitsPerAdmin: '1',
      }).calculable,
    ).toBe(false)
  })

  it('does not invent a quantity for topical products or inhalers', () => {
    expect(
      suggestDispenseQuantity({
        route: 'topical',
        unit: 'tube',
        frequency: 'BD',
        duration: '7 days',
        unitsPerAdmin: '1',
      }).calculable,
    ).toBe(false)
    expect(
      suggestDispenseQuantity({
        route: 'inhalation',
        unit: 'puff',
        frequency: 'BD',
        duration: '30 days',
        unitsPerAdmin: '2',
      }).calculable,
    ).toBe(false)
  })
})

describe('prescription line validation', () => {
  it('requires an exact catalogue id, dose, frequency, route and positive quantity', () => {
    expect(lineValidationError({ itemId: '', quantity: '10', dose: '500 mg', frequency: 'TDS', route: 'oral' })).toMatch(
      /catalogue/,
    )
    expect(lineValidationError({ itemId: 'item-a', quantity: '0', dose: '500 mg', frequency: 'TDS', route: 'oral' })).toMatch(
      /positive quantity/,
    )
    expect(lineValidationError({ itemId: 'item-a', quantity: '10', dose: '', frequency: 'TDS', route: 'oral' })).toMatch(
      /Dose and frequency/,
    )
    expect(lineValidationError({ itemId: 'item-a', quantity: '10', dose: '500 mg', frequency: 'TDS', route: '' })).toMatch(
      /Route/,
    )
    expect(
      lineValidationError({ itemId: 'item-a', quantity: '10', dose: '500 mg', frequency: 'TDS', route: 'topical' }),
    ).toBeNull()
  })
})
