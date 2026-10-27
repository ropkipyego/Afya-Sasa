import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HOSPITAL_ACCOUNT_KINDS, isHospitalAccountKind } from './hospital-accounts.ts'

describe('hospital billing accounts', () => {
  it('covers cash, SHA, insurance, corporate, staff and waiver', () => {
    assert.deepEqual(
      HOSPITAL_ACCOUNT_KINDS.map((row) => row.value),
      ['cash', 'sha', 'insurance', 'corporate', 'staff', 'waiver'],
    )
    assert.equal(isHospitalAccountKind('sha'), true)
    assert.equal(isHospitalAccountKind('mpesa'), false)
  })
})
