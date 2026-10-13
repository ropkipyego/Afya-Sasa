export const PATIENT_EXPORT_FIELDS = [
  { key: 'patientNo', label: 'Hospital number', sensitive: false },
  { key: 'firstName', label: 'First name', sensitive: true },
  { key: 'middleName', label: 'Middle name', sensitive: true },
  { key: 'lastName', label: 'Last name', sensitive: true },
  { key: 'dateOfBirth', label: 'Date of birth', sensitive: true },
  { key: 'gender', label: 'Gender', sensitive: false },
  { key: 'primaryPhone', label: 'Primary phone', sensitive: true },
  { key: 'county', label: 'County', sensitive: false },
  { key: 'subCounty', label: 'Sub-county', sensitive: false },
  { key: 'createdAt', label: 'Registered at', sensitive: false },
] as const

export type PatientExportField = (typeof PATIENT_EXPORT_FIELDS)[number]['key']

const ALLOWED = new Set(PATIENT_EXPORT_FIELDS.map((field) => field.key))

export function sanitizePatientExportFields(requested: string[] | undefined) {
  const unique = [...new Set((requested ?? []).map((value) => value.trim()).filter(Boolean))]
  const fields = unique.filter((key): key is PatientExportField => ALLOWED.has(key as PatientExportField))
  if (!fields.length) {
    return PATIENT_EXPORT_FIELDS.filter((field) => !field.sensitive).map((field) => field.key)
  }
  return fields
}
