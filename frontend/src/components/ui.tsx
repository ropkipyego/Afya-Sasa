import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'

/* ── Primitives ───────────────────────────────────────────── */

const inputBase =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputBase, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(inputBase, 'min-h-[96px] resize-y', props.className)}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputBase, props.className)} />
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-500/30 disabled:bg-teal-300',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-200',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500/30 disabled:bg-red-300',
}

export function Button({
  variant = 'primary',
  loading,
  children,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed',
        buttonStyles[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

/* ── Form fields ──────────────────────────────────────────── */

export function Field({
  name,
  label,
  hint,
  type = 'text',
  required = false,
  className,
  ...props
}: {
  name: string
  label: string
  hint?: string
  type?: string
  required?: boolean
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'required'>) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <Input name={name} type={type} required={required} {...props} />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function SelectField({
  name,
  label,
  hint,
  required = false,
  children,
  className,
  ...props
}: {
  name: string
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'required'>) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <Select name={name} required={required} {...props}>
        {children}
      </Select>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function TextareaField({
  name,
  label,
  hint,
  required = false,
  className,
  ...props
}: {
  name: string
  label: string
  hint?: string
  required?: boolean
  className?: string
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'required'>) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <Textarea name={name} required={required} {...props} />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string
  description?: string
  children: ReactNode
  columns?: 1 | 2 | 3
}) {
  const colClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2'

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className={clsx('grid gap-4', colClass)}>{children}</div>
    </section>
  )
}

export function FormActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ── Layout ───────────────────────────────────────────────── */

export function Card({
  children,
  className,
  padding = 'md',
}: {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}) {
  const pad =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-4'
        : padding === 'lg'
          ? 'p-8'
          : 'p-6'

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        pad,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-xl font-bold tracking-tight text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function WorkflowSteps({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={clsx(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                done && 'bg-teal-50 text-teal-700',
                active && 'bg-teal-600 text-white',
                !done && !active && 'bg-slate-100 text-slate-500',
              )}
            >
              <span
                className={clsx(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                  done && 'bg-teal-600 text-white',
                  active && 'bg-white/20 text-white',
                  !done && !active && 'bg-white text-slate-400',
                )}
              >
                {done ? '✓' : index + 1}
              </span>
              {step}
            </span>
            {index < steps.length - 1 ? (
              <span className="hidden h-px w-4 bg-slate-200 sm:block" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/* ── Feedback ─────────────────────────────────────────────── */

type AlertTone = 'success' | 'error' | 'warning' | 'info'

const alertStyles: Record<
  AlertTone,
  { wrap: string; icon: typeof CheckCircle2 }
> = {
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  error: { wrap: 'border-red-200 bg-red-50 text-red-800', icon: XCircle },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info },
}

export function Alert({
  tone,
  title,
  children,
  className,
}: {
  tone: AlertTone
  title?: string
  children: ReactNode
  className?: string
}) {
  const Icon = alertStyles[tone].icon
  return (
    <div
      className={clsx(
        'flex gap-3 rounded-lg border px-4 py-3 text-sm',
        alertStyles[tone].wrap,
        className,
      )}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* ── Clinical widgets ─────────────────────────────────────── */

export function PatientContextBanner({
  patient,
  emptyLabel = 'No patient selected',
}: {
  patient: { firstName: string; lastName: string; patientNo: string; primaryPhone?: string } | null
  emptyLabel?: string
}) {
  if (!patient) {
    return (
      <Alert tone="warning" title="Patient required">
        {emptyLabel}
      </Alert>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Active patient
        </p>
        <p className="font-semibold text-teal-950">
          {patient.firstName} {patient.lastName}
        </p>
        <p className="text-sm text-teal-800">
          {patient.patientNo}
          {patient.primaryPhone ? ` · ${patient.primaryPhone}` : ''}
        </p>
      </div>
      <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
        Selected
      </span>
    </div>
  )
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading,
  buttonLabel = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  placeholder: string
  loading?: boolean
  buttonLabel?: string
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
      <Input
        className="flex-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <Button type="submit" loading={loading} className="sm:min-w-[120px]">
        {buttonLabel}
      </Button>
    </form>
  )
}

export function QuickAddForm({
  title,
  pending,
  onSubmit,
  children,
  submitLabel = 'Save',
}: {
  title: string
  pending: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  submitLabel?: string
}) {
  return (
    <form
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-3">{children}</div>
      <FormActions className="border-0 pt-0">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  )
}

export function ClinicalForm({
  children,
  onSubmit,
  className,
}: {
  children: ReactNode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  className?: string
}) {
  return (
    <form
      className={clsx('space-y-6', className)}
      onSubmit={onSubmit}
      noValidate
    >
      {children}
    </form>
  )
}

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="md" className="border-teal-100/80">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
    </Card>
  )
}

export function normaliseTriageColour(colour?: string | null) {
  const key = colour?.toLowerCase().trim() ?? ''
  if (key in triagePalette) return key
  return 'unknown'
}

const triagePalette = {
  red: {
    badge: 'bg-red-100 text-red-900 ring-1 ring-red-200',
    dot: 'bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.25)]',
    card: 'border-l-red-600 bg-red-50/60 hover:bg-red-50',
    ring: 'ring-red-300',
  },
  orange: {
    badge: 'bg-orange-100 text-orange-950 ring-1 ring-orange-200',
    dot: 'bg-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.25)]',
    card: 'border-l-orange-500 bg-orange-50/60 hover:bg-orange-50',
    ring: 'ring-orange-300',
  },
  yellow: {
    badge: 'bg-yellow-100 text-yellow-950 ring-1 ring-yellow-300',
    dot: 'bg-yellow-400 shadow-[0_0_0_3px_rgba(250,204,21,0.35)]',
    card: 'border-l-yellow-400 bg-yellow-50/70 hover:bg-yellow-50',
    ring: 'ring-yellow-300',
  },
  green: {
    badge: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]',
    card: 'border-l-emerald-500 bg-emerald-50/60 hover:bg-emerald-50',
    ring: 'ring-emerald-300',
  },
  blue: {
    badge: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200',
    dot: 'bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.25)]',
    card: 'border-l-sky-500 bg-sky-50/60 hover:bg-sky-50',
    ring: 'ring-sky-300',
  },
  unknown: {
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    dot: 'bg-slate-400',
    card: 'border-l-slate-300 bg-white hover:bg-slate-50',
    ring: 'ring-slate-200',
  },
} as const

export function triageCardAccent(colour?: string | null) {
  return triagePalette[normaliseTriageColour(colour) as keyof typeof triagePalette].card
}

export function TriageBadge({ colour }: { colour?: string | null }) {
  const key = normaliseTriageColour(colour) as keyof typeof triagePalette
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase',
        triagePalette[key].badge,
      )}
    >
      <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', triagePalette[key].dot)} />
      {colour ?? 'untriaged'}
    </span>
  )
}

export function TriageIndicator({
  colour,
  label,
  size = 'md',
}: {
  colour?: string | null
  label?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const key = normaliseTriageColour(colour) as keyof typeof triagePalette
  const dotSize = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={clsx('shrink-0 rounded-full', dotSize, triagePalette[key].dot)}
        title={label ?? colour ?? 'Untriaged'}
      />
      <div>
        {label ? <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p> : null}
        <p className="text-xs font-bold uppercase text-slate-800">{colour ?? 'untriaged'}</p>
      </div>
    </div>
  )
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const styles: Record<string, string> = {
    stat: 'bg-red-600 text-white',
    urgent: 'bg-amber-500 text-white',
    routine: 'bg-slate-600 text-white',
  }
  const key = priority?.toLowerCase() ?? 'routine'
  return (
    <span
      className={clsx(
        'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        styles[key] ?? styles.routine,
      )}
    >
      {priority ?? 'routine'}
    </span>
  )
}

export function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
      {status?.replace(/_/g, ' ') ?? 'unknown'}
    </span>
  )
}

export function FileUploadZone({
  accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx',
  file,
  onFileChange,
  hint = 'PDF, image, or document — drag and drop or click to browse',
}: {
  accept?: string
  file: File | null
  onFileChange: (file: File | null) => void
  hint?: string
}) {
  return (
    <label className="group block cursor-pointer">
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center transition group-hover:border-teal-400 group-hover:bg-teal-50/40">
        {file ? (
          <>
            <p className="text-sm font-semibold text-teal-800">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB · Click to replace
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700">Upload report file</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </>
        )}
      </div>
    </label>
  )
}

export function DashboardHero({
  title,
  description,
  metrics,
}: {
  title: string
  description: string
  metrics: { label: string; value: number | string }[]
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-950 via-teal-900 to-teal-800 p-6 text-white shadow-lg">
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm text-teal-100/90">{description}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-200">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ClinicalSafetyBanner({
  patient,
}: {
  patient: {
    allergies?: { allergen: string }[]
    chronicConditions?: { name: string }[]
  }
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
        <p className="text-[11px] font-bold uppercase tracking-wide">Allergies</p>
        <p className="mt-1 text-sm">
          {patient.allergies?.map((a) => a.allergen).join(', ') || 'None recorded'}
        </p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
        <p className="text-[11px] font-bold uppercase tracking-wide">Chronic conditions</p>
        <p className="mt-1 text-sm">
          {patient.chronicConditions?.map((c) => c.name).join(', ') || 'None recorded'}
        </p>
      </div>
    </div>
  )
}
