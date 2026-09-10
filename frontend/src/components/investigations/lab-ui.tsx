import { useEffect, type ReactNode } from 'react'
import clsx from 'clsx'
import { FlaskConical, type LucideIcon } from 'lucide-react'

export const LAB_STATUS: Record<
  string,
  { label: string; tone: string; dot: string }
> = {
  requested: { label: 'Requested', tone: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  sample_collected: { label: 'Collected', tone: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500' },
  processing: { label: 'Processing', tone: 'bg-violet-50 text-violet-900 ring-violet-200', dot: 'bg-violet-500' },
  resulted: { label: 'Resulted', tone: 'bg-teal-50 text-teal-900 ring-teal-200', dot: 'bg-teal-500' },
  scheduled: { label: 'Scheduled', tone: 'bg-indigo-50 text-indigo-900 ring-indigo-200', dot: 'bg-indigo-500' },
  in_progress: { label: 'In progress', tone: 'bg-violet-50 text-violet-900 ring-violet-200', dot: 'bg-violet-500' },
  reported: { label: 'Reported', tone: 'bg-teal-50 text-teal-900 ring-teal-200', dot: 'bg-teal-500' },
  ordered: { label: 'Ordered', tone: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  pending: { label: 'Pending', tone: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500' },
  dispensed: { label: 'Dispensed', tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200', dot: 'bg-emerald-500' },
  verified: { label: 'Verified', tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
}

export const LAB_PRIORITY: Record<string, { label: string; tone: string }> = {
  stat: { label: 'STAT', tone: 'bg-rose-600 text-white shadow-sm shadow-rose-200' },
  urgent: { label: 'Urgent', tone: 'bg-amber-500 text-white shadow-sm shadow-amber-200' },
  routine: { label: 'Routine', tone: 'bg-slate-100 text-slate-700' },
}

export function waitLabel(createdAt: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function LabHero({
  title,
  description,
  stats,
}: {
  title: string
  description: string
  stats?: Array<{ label: string; value: number | string; tone?: string }>
}) {
  return (
    <div className="lab-hero relative overflow-hidden rounded-3xl border border-teal-900/10 bg-gradient-to-br from-teal-950 via-slate-900 to-cyan-950 px-6 py-7 text-white shadow-xl shadow-teal-950/20 md:px-8 md:py-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-100 ring-1 ring-white/10">
            <FlaskConical className="h-3.5 w-3.5" />
            Laboratory Information System
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-teal-100/90 md:text-base">{description}</p>
        </div>
        {stats?.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={clsx(
                  'min-w-[5.5rem] rounded-2xl px-4 py-3 ring-1 ring-white/10 backdrop-blur-sm',
                  stat.tone ?? 'bg-white/10',
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100/70">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function LabStatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone: string
  hint?: string
}) {
  return (
    <div className={clsx('lab-stat-card rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md', tone)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-white/60 p-2.5 shadow-sm">
          <Icon className="h-5 w-5 opacity-80" />
        </div>
      </div>
    </div>
  )
}

export function LabStatusChip({ status }: { status: string }) {
  const meta = LAB_STATUS[status] ?? {
    label: status.replaceAll('_', ' '),
    tone: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1', meta.tone)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

export function LabPriorityChip({ priority }: { priority: string }) {
  const meta = LAB_PRIORITY[priority] ?? LAB_PRIORITY.routine
  return (
    <span className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', meta.tone)}>
      {meta.label}
    </span>
  )
}

export function LabFlagBadge({ flag }: { flag?: string | null }) {
  if (!flag || flag === 'normal') {
    return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Normal</span>
  }
  const tone =
    flag.includes('critical') || flag === 'CRITICAL'
      ? 'bg-rose-100 text-rose-800'
      : flag === 'high' || flag === 'HIGH'
        ? 'bg-orange-100 text-orange-800'
        : 'bg-amber-100 text-amber-900'
  return <span className={clsx('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', tone)}>{flag.replaceAll('_', ' ')}</span>
}

export function LabEmptyState({
  icon: Icon = FlaskConical,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-8 w-8 text-teal-600/70" />
      </div>
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function LabSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('rounded-3xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 ring-1 ring-teal-100">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  )
}

export function LabPatientStrip({
  firstName,
  lastName,
  patientNo,
  status,
  priority,
  wait,
}: {
  firstName?: string
  lastName?: string
  patientNo?: string
  status?: string
  priority?: string
  wait?: string
}) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?'
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-slate-50 to-teal-50/50 px-4 py-4 ring-1 ring-slate-200">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-sm font-bold text-white shadow-md shadow-teal-900/20">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold text-slate-900">
          {firstName} {lastName}
        </p>
        <p className="text-sm text-slate-500">{patientNo ?? '—'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status ? <LabStatusChip status={status} /> : null}
        {priority ? <LabPriorityChip priority={priority} /> : null}
        {wait ? <span className="text-xs font-medium text-slate-500">Waiting {wait}</span> : null}
      </div>
    </div>
  )
}

export function LabQueueItem({
  active,
  onClick,
  name,
  patientNo,
  status,
  priority,
  wait,
  subtitle,
}: {
  active?: boolean
  onClick: () => void
  name: string
  patientNo?: string
  status: string
  priority: string
  wait?: string
  subtitle?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'lab-queue-item w-full rounded-2xl border p-4 text-left transition',
        active
          ? 'border-teal-400 bg-teal-50/80 shadow-md shadow-teal-100 ring-2 ring-teal-200/80'
          : 'border-slate-200 bg-white hover:border-teal-200 hover:shadow-sm',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">{patientNo ?? '—'}</p>
        </div>
        <LabPriorityChip priority={priority} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LabStatusChip status={status} />
        {wait ? <span className="text-[11px] font-medium text-slate-400">{wait} wait</span> : null}
      </div>
      {subtitle ? <p className="mt-2 truncate text-xs text-teal-700">{subtitle}</p> : null}
    </button>
  )
}

export function LabModal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className={clsx(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl',
          wide ? 'max-w-4xl' : 'max-w-2xl',
        )}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

export function LabKanbanColumn({
  label,
  count,
  tone,
  children,
}: {
  label: string
  count: number
  tone: string
  children: ReactNode
}) {
  return (
    <div className={clsx('lab-kanban-column flex min-h-[28rem] flex-col rounded-2xl border p-3', tone)}>
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{label}</p>
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-sm">
          {count}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">{children}</div>
    </div>
  )
}
