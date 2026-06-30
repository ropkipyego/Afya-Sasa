import type { VitalAssessment } from './vital-types'

export function getClinicalVitalLabel(
  name: string,
  value: number,
  assessment: VitalAssessment,
): string | null {
  if (assessment === 'normal') return null

  switch (name) {
    case 'temperature':
      if (value > 37.5) return 'Fever'
      if (value < 36.1) return 'Hypothermia'
      return 'Abnormal temperature'
    case 'pulse':
      if (value < 60) return 'Bradycardia'
      if (value > 100) return 'Tachycardia'
      return 'Abnormal pulse'
    case 'respiratoryRate':
      if (value < 12) return 'Bradypnoea'
      if (value > 20) return 'Tachypnoea'
      return 'Abnormal respiratory rate'
    case 'spo2':
      if (value < 95) return 'Low Oxygen'
      return 'Abnormal SpO₂'
    case 'bpSystolic':
      if (value >= 140) return 'High Blood Pressure'
      if (value < 90) return 'Hypotension'
      return 'Elevated systolic BP'
    case 'bpDiastolic':
      if (value >= 90) return 'High Blood Pressure'
      if (value < 60) return 'Low diastolic BP'
      return 'Elevated diastolic BP'
    default:
      return assessment === 'critical' ? 'Critical' : 'Abnormal'
  }
}

export function combinedBpLabel(systolic: number, diastolic: number): string | null {
  if (systolic >= 140 || diastolic >= 90) return 'High Blood Pressure'
  if (systolic < 90 || diastolic < 60) return 'Low Blood Pressure'
  return null
}
