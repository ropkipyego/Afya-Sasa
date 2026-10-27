import { describe, expect, it } from 'vitest'
import { NAV_GROUP_ORDER, navigation, workflowDescriptions } from './navigation'

describe('hospital navigation groups', () => {
  it('puts OPD work in OPD and IPD work in IPD', () => {
    const byLabel = Object.fromEntries(navigation.map((item) => [item.label, item.group]))
    expect(byLabel['Triage Queue']).toBe('OPD Module')
    expect(byLabel['Doctor Queue']).toBe('OPD Module')
    expect(byLabel['Sick Sheets']).toBe('OPD Module')
    expect(byLabel['Referrals']).toBe('OPD Module')
    expect(byLabel['Inpatient (IPD)']).toBe('IPD Module')
    expect(byLabel['Nursing']).toBe('IPD Module')
    expect(byLabel['ICU']).toBe('IPD Module')
    expect(byLabel['Lab Queue']).toBe('Laboratory')
    expect(byLabel['Blood Bank']).toBe('Laboratory')
    expect(byLabel['Imaging Queue']).toBe('Radiology')
  })

  it('keeps store work out of pharmacy', () => {
    const store = navigation.find((item) => item.label === 'Inventory & Store')
    expect(store?.group).toBe('Procurement and Store')
    expect(navigation.filter((item) => item.group === 'Pharmacy & Supply').map((item) => item.label)).not.toContain(
      'Inventory & Store',
    )
  })

  it('hides Insurance & Claims from patients:read-only staff', () => {
    const insurance = navigation.find((item) => item.label === 'Insurance & Claims')
    expect(insurance?.permission).toBe('payments:read')
    expect(insurance?.permission).not.toBe('patients:read')
  })

  it('describes Theatre as bookings and notes, not a full peri-operative programme', () => {
    const copy = workflowDescriptions.Theatre ?? ''
    expect(copy.toLowerCase()).toContain('bookings')
    expect(copy.toLowerCase()).not.toMatch(/complete peri-operative|full theatre suite/)
  })

  it('describes Blood Bank as grouping and issue, not a bedside transfusion chart', () => {
    const copy = workflowDescriptions['Blood Bank'] ?? ''
    expect(copy.toLowerCase()).toContain('crossmatch')
    expect(copy.toLowerCase()).not.toMatch(/bedside transfusion chart|donor programme/)
  })

  it('orders OPD before IPD and procurement after pharmacy', () => {
    expect(NAV_GROUP_ORDER.indexOf('OPD Module')).toBeLessThan(NAV_GROUP_ORDER.indexOf('IPD Module'))
    expect(NAV_GROUP_ORDER.indexOf('Laboratory')).toBeLessThan(NAV_GROUP_ORDER.indexOf('Radiology'))
    expect(NAV_GROUP_ORDER.indexOf('Pharmacy & Supply')).toBeLessThan(
      NAV_GROUP_ORDER.indexOf('Procurement and Store'),
    )
  })
})
