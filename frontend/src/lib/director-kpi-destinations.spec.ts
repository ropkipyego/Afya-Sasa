import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DIRECTOR_KPI_DESTINATIONS } from './director-kpi-destinations.ts'

describe('Director dashboard KPI destinations', () => {
  it('sends IPD metrics to the inpatient module, not a placeholder', () => {
    assert.equal(DIRECTOR_KPI_DESTINATIONS.currentInpatients, 'Inpatient (IPD)')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.admissions, 'Inpatient (IPD)')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.discharges, 'Inpatient (IPD)')
  })

  it('sends OPD, lab, radiology, pharmacy stock and finance to existing desks', () => {
    assert.equal(DIRECTOR_KPI_DESTINATIONS.opdVisits, 'Doctor Queue')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.labRequests, 'Laboratory')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.radiologyRequests, 'Radiology')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.expiryRiskBatches, 'Products & Stock')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.collections, 'Cashier / Billing')
    assert.equal(DIRECTOR_KPI_DESTINATIONS.emergencyCases, 'Emergency')
  })
})
