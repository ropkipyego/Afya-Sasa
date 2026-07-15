import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useState } from 'react'
import clsx from 'clsx'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react'

/* ── Primitives ───────────────────────────────────────────── */

const inputBase =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputBase, props.className)} />
}

/** Password input with show/hide toggle (works with controlled or uncontrolled fields). */
export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={clsx('pr-11', className)}
        autoComplete={props.autoComplete ?? 'current-password'}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
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
      {type === 'password' ? (
        <PasswordInput name={name} required={required} {...props} />
      ) : (
        <Input name={name} type={type} required={required} {...props} />
      )}
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

export function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  columns = 2,
}: {
  title: string
  description?: string
  children: ReactNode
  defaultOpen?: boolean
  columns?: 1 | 2 | 3
}) {
  const [open, setOpen] = useState(defaultOpen)
  const colClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2'

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={clsx(
            'h-5 w-5 shrink-0 text-teal-600 transition-transform duration-200',
            open ? 'rotate-180' : 'rotate-0',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className={clsx('grid gap-4 border-t border-slate-100 bg-slate-50/40 p-5', colClass)}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
  defaultOpen = true,
  collapsible = true,
}: {
  title: string
  description?: string
  children: ReactNode
  columns?: 1 | 2 | 3
  defaultOpen?: boolean
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const colClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2'

  const heading = title ? (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {description ? (
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      ) : null}
    </div>
  ) : description ? (
    <p className="text-xs text-slate-500">{description}</p>
  ) : null

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
      {collapsible && heading ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/80"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {heading}
          <ChevronDown
            className={clsx(
              'h-5 w-5 shrink-0 text-teal-600 transition-transform duration-200',
              open ? 'rotate-180' : 'rotate-0',
            )}
            aria-hidden
          />
        </button>
      ) : heading ? (
        <div className="px-5 pt-5">{heading}</div>
      ) : null}
      {(!collapsible || open || !heading) ? (
        <div
          className={clsx(
            'grid gap-4 px-5 pb-5',
            heading && collapsible ? 'pt-1' : 'pt-5',
            colClass,
          )}
        >
          {children}
        </div>
      ) : null}
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

/* ── Triage & status ─────────────────────────────────────── */

export function normaliseTriageColour(colour?: string | null) {
  const key = colour?.toLowerCase().trim() ?? ''
  if (key in triagePalette) return key
  return 'unknown'
}

const triagePalette = {
  red: {
    badge: 'bg-red-100 text-red-900 ring-1 ring-red-200',
    dot: 'bg-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.2)]',
    card: 'border-l-red-600 bg-red-50/70',
    panel: 'bg-red-50/40 ring-red-200/60',
  },
  orange: {
    badge: 'bg-orange-100 text-orange-950 ring-1 ring-orange-200',
    dot: 'bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.2)]',
    card: 'border-l-orange-500 bg-orange-50/70',
    panel: 'bg-orange-50/40 ring-orange-200/60',
  },
  yellow: {
    badge: 'bg-yellow-100 text-yellow-950 ring-1 ring-yellow-300',
    dot: 'bg-yellow-400 shadow-[0_0_0_4px_rgba(250,204,21,0.35)]',
    card: 'border-l-yellow-400 bg-yellow-50/80',
    panel: 'bg-yellow-50/50 ring-yellow-200/60',
  },
  green: {
    badge: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]',
    card: 'border-l-emerald-500 bg-emerald-50/70',
    panel: 'bg-emerald-50/40 ring-emerald-200/60',
  },
  blue: {
    badge: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200',
    dot: 'bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.2)]',
    card: 'border-l-sky-500 bg-sky-50/70',
    panel: 'bg-sky-50/40 ring-sky-200/60',
  },
  unknown: {
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    dot: 'bg-slate-400',
    card: 'border-l-slate-300 bg-white',
    panel: 'bg-white ring-slate-200',
  },
} as const

export function triageCardAccent(colour?: string | null) {
  return triagePalette[normaliseTriageColour(colour) as keyof typeof triagePalette].card
}

export function triagePanelAccent(colour?: string | null) {
  return triagePalette[normaliseTriageColour(colour) as keyof typeof triagePalette].panel
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
      <span className={clsx('h-2.5 w-2.5 rounded-full', triagePalette[key].dot)} />
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
      <span className={clsx('shrink-0 rounded-full', dotSize, triagePalette[key].dot)} />
      <div>
        {label ? <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p> : null}
        <p className="text-xs font-bold uppercase text-slate-800">{colour ?? 'untriaged'}</p>
      </div>
    </div>
  )
}

export function FileUploadZone({
  accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx',
  file,
  onFileChange,
  hint = 'PDF or image — drag and drop or click to browse',
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
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center transition duration-200 group-hover:border-teal-400 group-hover:bg-teal-50/40">
        {file ? (
          <>
            <p className="text-sm font-semibold text-teal-800">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB · Click to replace
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700">Upload document</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </>
        )}
      </div>
    </label>
  )
}

export function NavGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 transition hover:text-slate-600"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            open ? 'rotate-180' : 'rotate-0',
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="space-y-0.5">{children}</div> : null}
    </div>
  )
}
