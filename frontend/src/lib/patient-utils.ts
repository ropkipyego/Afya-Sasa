export type PatientLike = {
  firstName: string
  lastName: string
  middleName?: string | null
  dateOfBirth: string
  gender?: string
  patientNo: string
  primaryPhone?: string
  identifiers?: { type: string; value: string }[]
  allergies?: { allergen: string; severity?: string }[]
  chronicConditions?: { name: string; status?: string }[]
}

export function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return Math.max(age, 0)
}

/** Last segment of JH-2026-00021 → 00021. Full MRN stays on the patient card. */
export function formatPatientNoShort(patientNo?: string | null): string {
  const value = patientNo?.trim() ?? ''
  if (!value) return '—'
  const parts = value.split('-').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : value
}

export function formatPatientName(patient: PatientLike): string {
  const middle = patient.middleName ? ` ${patient.middleName}` : ''
  return `${patient.firstName}${middle} ${patient.lastName}`.trim()
}

export function primaryIdentifier(patient: PatientLike): string | null {
  const id = patient.identifiers?.[0]
  if (!id) return null
  return `${id.type.replace(/_/g, ' ')}: ${id.value}`
}

export function hasAllergies(patient: PatientLike): boolean {
  return (patient.allergies?.length ?? 0) > 0
}

export function hasChronicConditions(patient: PatientLike): boolean {
  return (patient.chronicConditions?.length ?? 0) > 0
}
