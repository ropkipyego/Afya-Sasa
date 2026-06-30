import clsx from 'clsx'
import {
  type WorkflowStep,
  workflowStepLabels,
  workflowStepTones,
} from '../lib/workflow-status'

export function WorkflowBadge({
  step,
  className,
}: {
  step: WorkflowStep
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        workflowStepTones[step],
        className,
      )}
    >
      {workflowStepLabels[step]}
    </span>
  )
}

export function WorkflowProgress({
  current,
  compact = false,
}: {
  current: WorkflowStep
  compact?: boolean
}) {
  const steps: WorkflowStep[] = [
    'checked_in',
    'waiting_triage',
    'waiting_doctor',
    'in_consultation',
    'discharged',
  ]
  const currentIndex = steps.indexOf(
    current === 'in_triage'
      ? 'waiting_triage'
      : current === 'waiting_lab' || current === 'lab_complete' || current === 'waiting_review'
        ? 'in_consultation'
        : current,
  )

  if (compact) {
    return <WorkflowBadge step={current} />
  }

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => {
        const done = currentIndex > index
        const active = currentIndex === index
        return (
          <li key={step} className="flex items-center gap-1.5">
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                done && 'bg-teal-100 text-teal-800',
                active && 'bg-teal-600 text-white',
                !done && !active && 'bg-slate-100 text-slate-400',
              )}
            >
              {workflowStepLabels[step]}
            </span>
            {index < steps.length - 1 ? (
              <span className="text-slate-300">›</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
