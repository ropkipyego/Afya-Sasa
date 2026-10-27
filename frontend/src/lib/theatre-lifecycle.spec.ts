import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { theatreMayEnter } from './theatre-lifecycle.ts'

describe('theatreMayEnter', () => {
  it('requires consent and checklist for elective cases', () => {
    assert.equal(theatreMayEnter('pending', 'complete', 'elective'), false)
    assert.equal(theatreMayEnter('signed', 'pending', 'elective'), false)
    assert.equal(theatreMayEnter('signed', 'complete', 'elective'), true)
  })

  it('lets emergency cases skip signed consent', () => {
    assert.equal(theatreMayEnter('pending', 'complete', 'emergency'), true)
  })
})
