import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bedsForEmergencyOutcome, type DispositionBed } from './emergency-disposition-beds.ts'

const beds: DispositionBed[] = [
  { id: '1', bedNo: 'G1', status: 'available', type: 'standard', ward: { name: 'Male', type: 'general' } },
  { id: '2', bedNo: 'I1', status: 'available', type: 'icu', ward: { name: 'ICU', type: 'icu' } },
  { id: '3', bedNo: 'H1', status: 'available', type: 'standard', ward: { name: 'HDU', type: 'hdu' } },
  { id: '4', bedNo: 'M1', status: 'occupied', type: 'maternity', ward: { name: 'Maternity', type: 'maternity' } },
]

describe('bedsForEmergencyOutcome', () => {
  it('filters ICU and HDU beds for those outcomes', () => {
    assert.deepEqual(
      bedsForEmergencyOutcome(beds, 'transferred_icu').map((row) => row.id),
      ['2'],
    )
    assert.deepEqual(
      bedsForEmergencyOutcome(beds, 'transferred_hdu').map((row) => row.id),
      ['3'],
    )
  })

  it('keeps general available beds for ordinary IPD admission', () => {
    assert.equal(bedsForEmergencyOutcome(beds, 'admitted_ipd').length, 3)
  })
})
