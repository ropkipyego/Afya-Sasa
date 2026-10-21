import { labWorkArea, labWorkAreaNextAction } from './lab-work-areas';

describe('laboratory work areas', () => {
  it('keeps a reception check-in out of formal request stages', () => {
    expect(labWorkArea('check_in')).toBe('other')
    expect(labWorkArea('WAITING')).toBe('other')
  })

  it('maps request statuses to the five operational areas', () => {
    expect(labWorkArea('requested')).toBe('specimen')
    expect(labWorkArea('sample_collected')).toBe('progress')
    expect(labWorkArea('processing')).toBe('progress')
    expect(labWorkArea('resulted')).toBe('verify')
    expect(labWorkArea('verified')).toBe('released')
    expect(labWorkAreaNextAction('resulted')).toMatch(/Verify/)
  })
})
