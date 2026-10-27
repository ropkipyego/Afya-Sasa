/** Who is billed. Collection method (cash/M-Pesa/card) is separate. */
export const HOSPITAL_ACCOUNT_KINDS = [
  { value: 'cash', label: 'Self-pay / cash patient' },
  { value: 'sha', label: 'SHA' },
  { value: 'insurance', label: 'Private insurance' },
  { value: 'corporate', label: 'Corporate / employer' },
  { value: 'staff', label: 'Staff account' },
  { value: 'waiver', label: 'Exemption / waiver' },
] as const

export type HospitalAccountKind = (typeof HOSPITAL_ACCOUNT_KINDS)[number]['value']

export function isHospitalAccountKind(value?: string | null): value is HospitalAccountKind {
  return HOSPITAL_ACCOUNT_KINDS.some((row) => row.value === value)
}

export function accountKindLabel(value?: string | null) {
  return HOSPITAL_ACCOUNT_KINDS.find((row) => row.value === value)?.label ?? 'Self-pay / cash patient'
}
