export type WorkflowStep =
  | 'registered'
  | 'checked_in'
  | 'waiting_triage'
  | 'in_triage'
  | 'waiting_doctor'
  | 'in_consultation'
  | 'waiting_lab'
  | 'lab_complete'
  | 'waiting_review'
  | 'discharged'
  | 'unknown'

export const workflowStepLabels: Record<WorkflowStep, string> = {
  registered: 'Registered',
  checked_in: 'Checked In',
  waiting_triage: 'Waiting For Triage',
  in_triage: 'In Triage',
  waiting_doctor: 'Waiting For Doctor',
  in_consultation: 'In Consultation',
  waiting_lab: 'Waiting For Lab',
  lab_complete: 'Lab Complete',
  waiting_review: 'Waiting For Review',
  discharged: 'Discharged',
  unknown: 'Unknown',
}

export const workflowStepOrder: WorkflowStep[] = [
  'registered',
  'checked_in',
  'waiting_triage',
  'in_triage',
  'waiting_doctor',
  'in_consultation',
  'waiting_lab',
  'lab_complete',
  'waiting_review',
  'discharged',
]

export const workflowStepTones: Record<WorkflowStep, string> = {
  registered: 'bg-slate-100 text-slate-700',
  checked_in: 'bg-blue-50 text-blue-800',
  waiting_triage: 'bg-amber-50 text-amber-900',
  in_triage: 'bg-orange-50 text-orange-900',
  waiting_doctor: 'bg-sky-50 text-sky-900',
  in_consultation: 'bg-teal-50 text-teal-900',
  waiting_lab: 'bg-violet-50 text-violet-900',
  lab_complete: 'bg-indigo-50 text-indigo-900',
  waiting_review: 'bg-purple-50 text-purple-900',
  discharged: 'bg-emerald-50 text-emerald-900',
  unknown: 'bg-slate-100 text-slate-600',
}

export function mapEncounterStatusToWorkflow(
  status: string,
  extras?: { hasPendingLab?: boolean; hasLabResults?: boolean },
): WorkflowStep {
  switch (status) {
    case 'registered':
      return 'waiting_triage'
    case 'triaged':
      return extras?.hasPendingLab
        ? 'waiting_lab'
        : extras?.hasLabResults
          ? 'waiting_review'
          : 'waiting_doctor'
    case 'in_consultation':
      return extras?.hasPendingLab ? 'waiting_lab' : 'in_consultation'
    case 'awaiting_results':
      return extras?.hasLabResults ? 'waiting_review' : 'waiting_lab'
    case 'completed':
      return 'discharged'
    default:
      return 'unknown'
  }
}

export function workflowProgressIndex(step: WorkflowStep): number {
  const index = workflowStepOrder.indexOf(step)
  return index >= 0 ? index : 0
}
