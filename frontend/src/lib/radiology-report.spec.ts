import { describe, expect, it } from 'vitest'
import { radiologyReportBodyFromForm, radiologyReportReady } from './radiology-report'

describe('radiology report payload', () => {
  it('sends the RadWeb URL with findings so the worklist cannot bypass server validation', () => {
    const form = new FormData()
    form.set('findings', 'Clear lung fields')
    form.set('impression', 'No acute process')
    form.set('recommendation', 'Routine follow-up')
    form.set('imageUrl', 'https://radweb.example/study/abc')
    expect(radiologyReportBodyFromForm(form)).toEqual({
      findings: 'Clear lung fields',
      impression: 'No acute process',
      recommendation: 'Routine follow-up',
      imageUrl: 'https://radweb.example/study/abc',
    })
    expect(radiologyReportReady(radiologyReportBodyFromForm(form))).toBeNull()
  })

  it('refuses a text-only report without a RadWeb link', () => {
    const form = new FormData()
    form.set('findings', 'Clear lung fields')
    form.set('impression', 'No acute process')
    const body = radiologyReportBodyFromForm(form)
    expect(body.imageUrl).toBe('')
    expect(radiologyReportReady(body)).toMatch(/RadWeb/i)
  })
})
