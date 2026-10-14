import { NAV_GROUP_ORDER, navigation } from './navigation'

describe('hospital navigation groups', () => {
  it('puts OPD work in OPD and IPD work in IPD', () => {
    const byLabel = Object.fromEntries(navigation.map((item) => [item.label, item.group]))
    expect(byLabel['Triage Queue']).toBe('OPD')
    expect(byLabel['Doctor Queue']).toBe('OPD')
    expect(byLabel['Sick Sheets']).toBe('OPD')
    expect(byLabel['Referrals']).toBe('OPD')
    expect(byLabel['Inpatient (IPD)']).toBe('IPD')
    expect(byLabel['Nursing']).toBe('IPD')
    expect(byLabel['ICU']).toBe('IPD')
  })

  it('keeps store work out of pharmacy', () => {
    const store = navigation.find((item) => item.label === 'Inventory & Store')
    expect(store?.group).toBe('Procurement and Store')
    expect(navigation.filter((item) => item.group === 'Pharmacy & Supply').map((item) => item.label)).not.toContain(
      'Inventory & Store',
    )
  })

  it('orders OPD before IPD and procurement after pharmacy', () => {
    expect(NAV_GROUP_ORDER.indexOf('OPD')).toBeLessThan(NAV_GROUP_ORDER.indexOf('IPD'))
    expect(NAV_GROUP_ORDER.indexOf('Pharmacy & Supply')).toBeLessThan(
      NAV_GROUP_ORDER.indexOf('Procurement and Store'),
    )
  })
})
