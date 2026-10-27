import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canAny } from './action-access'

describe('action access matches API permission keys', () => {
  it('allows an action when any required key is present', () => {
    assert.equal(canAny(['pharmacy:read', 'pharmacy:dispense'], ['pharmacy:dispense']), true)
    assert.equal(canAny(['pharmacy:read'], ['pharmacy:dispense', 'payments:manage']), false)
    assert.equal(canAny(['payments:manage'], ['pharmacy:dispense', 'payments:manage']), true)
  })

  it('does not treat screen-read as authorization to write', () => {
    assert.equal(canAny(['emergency:read'], ['emergency:create']), false)
    assert.equal(canAny(['admissions:read'], ['admissions:discharge']), false)
    assert.equal(canAny(['surgery_bookings:read'], ['surgery_bookings:create']), false)
  })
})
