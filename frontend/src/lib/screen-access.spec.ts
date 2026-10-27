import { describe, expect, it } from 'vitest'
import type { ExtendedClinicalCatalog } from './hospital-configuration'
import {
  canAccessScreen,
  firstAccessibleScreen,
  imagingInitialTab,
  labInitialTab,
  requiredPermissionForScreen,
} from './screen-access'

describe('laboratory and radiology menu destinations', () => {
  it('sends Laboratory to overview, Lab Queue to worklist, Blood Bank to the request desk', () => {
    expect(labInitialTab('Laboratory')).toBe('overview')
    expect(labInitialTab('Lab Queue')).toBe('worklist')
    expect(labInitialTab('Blood Bank')).toBe('bloodbank')
    expect(labInitialTab('Lab Dashboard')).toBe('overview')
  })

  it('does not collapse Radiology overview into the imaging worklist', () => {
    expect(imagingInitialTab('Radiology')).toBe('overview')
    expect(imagingInitialTab('Imaging Queue')).toBe('worklist')
    expect(imagingInitialTab('Imaging Dashboard')).toBe('overview')
    expect(imagingInitialTab('Imaging')).toBe('overview')
  })
})

describe('screen entry matches navigation permissions', () => {
  it('maps aliases to the canonical item permission', () => {
    expect(requiredPermissionForScreen('Finance')).toBe('payments:initiate')
    expect(requiredPermissionForScreen('Payments')).toBe('payments:initiate')
    expect(requiredPermissionForScreen('Pharmacy Queue')).toBe('pharmacy:read')
    expect(requiredPermissionForScreen('Stock Oversight')).toBe('inventory:read')
    expect(requiredPermissionForScreen('Doctor Queue')).toBe('consultations:read')
  })

  it('allows a screen only when the nav permission is present', () => {
    expect(canAccessScreen('Doctor Queue', ['consultations:read'])).toBe(true)
    expect(canAccessScreen('Doctor Queue', ['reports:read'])).toBe(false)
    expect(canAccessScreen('Cashier / Billing', ['payments:initiate'])).toBe(true)
    expect(canAccessScreen('Finance', ['payments:initiate'])).toBe(true)
    expect(canAccessScreen('Finance', ['reports:read'])).toBe(false)
  })

  it('does not treat a hidden menu as authorization for an unknown label', () => {
    expect(canAccessScreen('Not A Real Desk', ['settings:manage', 'patients:read'])).toBe(false)
    expect(canAccessScreen('Doctor Queue', [])).toBe(false)
  })

  it('keeps pharmacy queue visible to readers; issue remains a separate API permission', () => {
    expect(canAccessScreen('OTC Point of Sale', ['pharmacy:read'])).toBe(true)
    expect(canAccessScreen('OTC Point of Sale', ['patients:read'])).toBe(false)
  })

  it('refuses a module that the facility catalogue has disabled', () => {
    const catalog = {
      facilities: [
        {
          id: 'main-hospital',
          name: 'Main',
          modules: { radiology: false, opd: true },
        },
      ],
    } as unknown as ExtendedClinicalCatalog
    expect(canAccessScreen('Radiology', ['radiology_requests:read'], catalog)).toBe(false)
    expect(canAccessScreen('Doctor Queue', ['consultations:read'], catalog)).toBe(true)
  })

  it('falls back to the first permitted nav item', () => {
    expect(firstAccessibleScreen(['consultations:read'])).toBe('Doctor Queue')
    expect(firstAccessibleScreen(['pharmacy:read'])).toBe('Dashboard')
  })
})
