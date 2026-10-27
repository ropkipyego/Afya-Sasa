import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { displayAppointmentReason, isWebsiteBooking } from './website-booking.ts'

describe('website booking channel', () => {
  it('detects the website prefix used by the public booking page', () => {
    assert.equal(isWebsiteBooking('[Website] Review'), true)
    assert.equal(displayAppointmentReason('[Website] Review'), 'Review')
    assert.equal(isWebsiteBooking('Desk booking'), false)
  })
})
