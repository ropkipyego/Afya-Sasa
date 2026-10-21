export type LabWorkAreaId = 'specimen' | 'progress' | 'verify' | 'released' | 'other'

export function labWorkArea(status: string): LabWorkAreaId {
  if (status === 'requested') return 'specimen'
  if (status === 'sample_collected' || status === 'processing') return 'progress'
  if (status === 'resulted') return 'verify'
  if (status === 'verified') return 'released'
  return 'other'
}

export function labWorkAreaNextAction(status: string): string {
  switch (labWorkArea(status)) {
    case 'specimen':
      return 'Collect or receive the specimen'
    case 'progress':
      return 'Enter structured results'
    case 'verify':
      return 'Verify and release the report'
    case 'released':
      return 'Print or view the released report'
    default:
      return 'Review this request'
  }
}

export const LAB_WORK_AREAS: Array<{ id: LabWorkAreaId; label: string; statuses: string[] }> = [
  { id: 'specimen', label: 'Awaiting specimen', statuses: ['requested'] },
  { id: 'progress', label: 'In progress', statuses: ['sample_collected', 'processing'] },
  { id: 'verify', label: 'Awaiting verification', statuses: ['resulted'] },
  { id: 'released', label: 'Released reports', statuses: ['verified'] },
]
