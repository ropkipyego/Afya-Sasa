export function openPatientFile(patientId: string) {
  if (!patientId) return
  window.dispatchEvent(
    new CustomEvent('afyasasa-open-patient-file', {
      detail: { patientId },
    }),
  )
}
