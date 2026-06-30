import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Card, PageHeader } from './ui'

export type TimelineEvent = {
  id?: string
  type: string
  occurredAt: string
  title: string
  summary: string
}

const eventTypeLabels: Record<string, string> = {
  registration: 'Registration',
  visit: 'Visit',
  triage: 'Triage',
  consultation: 'Consultation',
  lab_request: 'Lab Request',
  lab_result: 'Lab Result',
  radiology: 'Radiology',
  admission: 'Admission',
  transfer: 'Transfer',
  icu: 'ICU',
  hdu: 'HDU',
  surgery: 'Theatre',
  maternity: 'Maternity',
  appointment: 'Appointment',
  referral: 'Referral',
  discharge: 'Discharge',
}

const eventTypeColors: Record<string, string> = {
  registration: 'bg-slate-500',
  visit: 'bg-blue-500',
  triage: 'bg-amber-500',
  consultation: 'bg-teal-500',
  lab_request: 'bg-violet-500',
  lab_result: 'bg-indigo-500',
  radiology: 'bg-purple-500',
  admission: 'bg-orange-500',
  icu: 'bg-red-500',
  hdu: 'bg-rose-500',
  surgery: 'bg-fuchsia-500',
  maternity: 'bg-pink-500',
  discharge: 'bg-emerald-500',
}

export function PatientTimeline({
  events,
  onSelect,
  title = 'Clinical timeline',
  description = 'Chronological patient journey — newest first.',
}: {
  events: TimelineEvent[]
  onSelect?: (event: TimelineEvent) => void
  title?: string
  description?: string
}) {
  const [filter, setFilter] = useState<string>('all')
  const types = useMemo(
    () => Array.from(new Set(events.map((event) => event.type))).sort(),
    [events],
  )

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((event) => event.type === filter)
  }, [events, filter])

  return (
    <Card>
      <PageHeader title={title} description={description} />
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        {types.map((type) => (
          <FilterChip key={type} active={filter === type} onClick={() => setFilter(type)}>
            {eventTypeLabels[type] ?? type}
          </FilterChip>
        ))}
      </div>
      <ol className="relative space-y-0 border-l-2 border-slate-200 pl-6">
        {filtered.map((event, index) => (
          <li key={`${event.type}-${event.occurredAt}-${index}`} className="relative pb-6">
            <span
              className={clsx(
                'absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full ring-4 ring-white',
                eventTypeColors[event.type] ?? 'bg-slate-400',
              )}
            />
            <button
              type="button"
              className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/40"
              onClick={() => onSelect?.(event)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase text-slate-500">
                  {eventTypeLabels[event.type] ?? event.type}
                </p>
                <time className="text-xs text-slate-400">
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{event.title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{event.summary}</p>
            </button>
          </li>
        ))}
        {!filtered.length ? (
          <p className="py-8 text-center text-sm text-slate-500">No timeline events for this filter.</p>
        ) : null}
      </ol>
    </Card>
  )
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full px-3 py-1 text-xs font-semibold transition',
        active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      )}
    >
      {children}
    </button>
  )
}
