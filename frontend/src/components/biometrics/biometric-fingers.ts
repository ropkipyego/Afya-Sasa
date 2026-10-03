export const BIOMETRIC_FINGERS = [
  { value: 'right_index', label: 'Right index finger' },
  { value: 'right_thumb', label: 'Right thumb' },
  { value: 'right_middle', label: 'Right middle finger' },
  { value: 'left_index', label: 'Left index finger' },
  { value: 'left_thumb', label: 'Left thumb' },
  { value: 'left_middle', label: 'Left middle finger' },
  { value: 'other', label: 'Other' },
] as const

export function fingerLabel(value?: string | null) {
  return BIOMETRIC_FINGERS.find((item) => item.value === value)?.label ?? value ?? 'Not specified'
}
