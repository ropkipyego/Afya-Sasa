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

export const LAB_WORK_AREAS: Array<{
  id: LabWorkAreaId
  label: string
  statuses: string[]
  tone: string
}> = [
  {
    id: 'specimen',
    label: 'Awaiting specimen',
    statuses: ['requested'],
    tone: 'border-sky-200/80 bg-gradient-to-b from-sky-50 to-white',
  },
  {
    id: 'progress',
    label: 'In progress',
    statuses: ['sample_collected', 'processing'],
    tone: 'border-violet-200/80 bg-gradient-to-b from-violet-50 to-white',
  },
  {
    id: 'verify',
    label: 'Awaiting verification',
    statuses: ['resulted'],
    tone: 'border-teal-200/80 bg-gradient-to-b from-teal-50 to-white',
  },
  {
    id: 'released',
    label: 'Released reports',
    statuses: ['verified'],
    tone: 'border-emerald-200/80 bg-gradient-to-b from-emerald-50 to-white',
  },
]
