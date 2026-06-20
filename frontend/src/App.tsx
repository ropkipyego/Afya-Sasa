import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Hospital,
  KeyRound,
  LogOut,
  Printer,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { apiRequest } from './lib/api'
import { useAuthStore } from './lib/auth-store'

interface PatientSummary {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone: string
  bloodGroup?: string | null
  qrCode?: string
  identifiers?: { type: string; value: string }[]
  nextOfKin?: {
    name: string
    relationship: string
    primaryPhone: string
    isEmergencyContact?: boolean
  }[]
  allergies?: { allergen: string; severity: string }[]
  chronicConditions?: { name: string; status: string }[]
}

interface PatientSearchResponse {
  items: PatientSummary[]
  meta: { page: number; pageSize: number; total: number }
}

const navigation = [
  { label: 'Patient Search', icon: Search, permission: 'patients:read' },
  { label: 'Register Patient', icon: UserPlus, permission: 'patients:create' },
  { label: 'Appointments', icon: CalendarDays, permission: 'appointments:read' },
  { label: 'Audit', icon: ShieldCheck, permission: 'audit_logs:read' },
]

function App() {
  const { user, accessToken, tenant, setTenant, clearSession } = useAuthStore()
  const [activeScreen, setActiveScreen] = useState('Patient Search')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)

  if (!accessToken || !user) {
    return <LoginScreen tenant={tenant} setTenant={setTenant} />
  }

  if (user.forcePasswordChange) {
    return <ForcedPasswordChangeScreen />
  }

  const allowedNavigation = navigation.filter((item) =>
    user.permissions.includes(item.permission),
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-600 p-3 text-white">
            <Hospital size={28} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600">
              AfyaSasa
            </p>
            <h1 className="text-lg font-bold">Clinical EMR</h1>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Tenant</p>
          <p>{tenant}</p>
        </div>

        <nav className="mt-8 space-y-2">
          {allowedNavigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                  activeScreen === item.label
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setActiveScreen(item.label)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Phase 1 Foundation</p>
              <h2 className="text-2xl font-bold">{activeScreen}</h2>
            </div>
            <div className="flex items-center gap-4">
              {user.forcePasswordChange ? <ForcedPasswordNotice /> : null}
              <div className="text-right text-sm">
                <p className="font-semibold">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-slate-500">{user.roles.join(', ')}</p>
              </div>
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                onClick={clearSession}
                aria-label="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <section className="p-6">
          {activeScreen === 'Patient Search' ? (
            <PatientSearch onSelect={(patient) => setSelectedPatientId(patient.id)} />
          ) : null}
          {activeScreen === 'Register Patient' ? <PatientRegistration /> : null}
          {activeScreen !== 'Patient Search' &&
          activeScreen !== 'Register Patient' ? (
            <Placeholder screen={activeScreen} />
          ) : null}
          {selectedPatientId ? (
            <PatientProfileDrawer
              patientId={selectedPatientId}
              onClose={() => setSelectedPatientId(null)}
            />
          ) : null}
        </section>
      </main>
    </div>
  )

}

function LoginScreen(props: {
  tenant: string
  setTenant: (tenant: string) => void
}) {
  const [email, setEmail] = useState('admin@demo.afyasasa.local')
  const [password, setPassword] = useState('')
  const setSession = useAuthStore((state) => state.setSession)
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{
        accessToken: string
        refreshToken: string
        user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, device: 'web' }),
      })
      setSession(result)
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950 p-6">
      <form
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl bg-blue-600 p-3 text-white">
            <Hospital />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase text-blue-600">
              AfyaSasa
            </p>
            <h1 className="text-2xl font-bold">Clinical Management</h1>
          </div>
        </div>
        <label className="mb-4 block">
          <span className="text-sm font-semibold text-slate-700">Tenant</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            value={props.tenant}
            onChange={(event) => props.setTenant(event.target.value)}
          />
        </label>
        <label className="mb-4 block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mb-6 block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mutation.error ? (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        ) : null}
        <button
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function ForcedPasswordNotice() {
  return (
    <div className="hidden items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 md:flex">
      <AlertTriangle size={16} />
      Password change required
    </div>
  )
}

function ForcedPasswordChangeScreen() {
  const clearSession = useAuthStore((state) => state.clearSession)
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest<{ changed: boolean }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword: form.get('newPassword'),
        }),
      })
    },
    onSuccess: () => {
      setMessage('Password changed. Please sign in again.')
      setTimeout(clearSession, 1200)
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950 p-6">
      <form
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate(event)
        }}
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500 p-3 text-white">
            <KeyRound />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase text-amber-600">
              First login security
            </p>
            <h1 className="text-2xl font-bold">Change your password</h1>
          </div>
        </div>
        <Field
          name="currentPassword"
          label="Current password"
          type="password"
          required
        />
        <div className="mt-4">
          <Field name="newPassword" label="New password" type="password" required />
        </div>
        {mutation.error ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        ) : null}
        <button
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Changing...' : 'Change password'}
        </button>
      </form>
    </div>
  )
}

function PatientSearch({
  onSelect,
}: {
  onSelect: (patient: PatientSummary) => void
}) {
  const [query, setQuery] = useState('')
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['patients', query],
    queryFn: () =>
      apiRequest<PatientSearchResponse>(
        `/patients?q=${encodeURIComponent(query)}`,
      ),
    enabled: false,
  })

  const patients = data?.items ?? []

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void refetch()
          }}
        >
          <input
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3"
            placeholder="Search by name, patient number, phone, ID, SHA, or QR"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
            {isFetching ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="mt-6 divide-y divide-slate-100">
          {patients.map((patient) => (
            <button
              key={patient.id}
              className="flex w-full items-center justify-between py-4 text-left hover:bg-slate-50"
              onClick={() => onSelect(patient)}
            >
              <div>
                <p className="font-bold">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {patient.patientNo} · {patient.gender} · {patient.primaryPhone}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                Open
              </span>
            </button>
          ))}
          {!patients.length ? (
            <p className="py-10 text-center text-slate-500">
              Search first before registering a new patient.
            </p>
          ) : null}
        </div>
      </div>

      <SafetyPanel />
    </div>
  )
}

function PatientRegistration() {
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest<PatientSummary>('/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          dateOfBirth: form.get('dateOfBirth'),
          gender: form.get('gender'),
          primaryPhone: form.get('primaryPhone'),
          identifiers: [
            {
              type: form.get('identifierType'),
              value: form.get('identifierValue'),
              isPrimary: true,
            },
          ],
        }),
      })
    },
    onSuccess: (patient) =>
      setMessage(`Registered ${patient.patientNo}. SMS queued.`),
  })

  return (
    <form
      className="max-w-4xl rounded-3xl bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate(event)
      }}
    >
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase text-blue-600">
          Search-first registration
        </p>
        <h3 className="text-2xl font-bold">Register a patient</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="firstName" label="First name" required />
        <Field name="lastName" label="Last name" required />
        <Field name="dateOfBirth" label="Date of birth" type="date" required />
        <label>
          <span className="text-sm font-semibold">Gender</span>
          <select
            name="gender"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            required
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="intersex">Intersex</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <Field name="primaryPhone" label="Primary phone" required />
        <label>
          <span className="text-sm font-semibold">Identifier type</span>
          <select
            name="identifierType"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            required
          >
            <option value="national_id">National ID</option>
            <option value="sha">SHA</option>
            <option value="passport">Passport</option>
            <option value="birth_certificate">Birth certificate</option>
            <option value="refugee_id">Refugee ID</option>
          </select>
        </label>
        <Field name="identifierValue" label="Identifier value" required />
      </div>
      {mutation.error ? (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {mutation.error.message}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}
      <button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
        {mutation.isPending ? 'Registering...' : 'Register patient'}
      </button>
    </form>
  )
}

function Field({
  name,
  label,
  type = 'text',
  required = false,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
}) {
  return (
    <label>
      <span className="text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
      />
    </label>
  )
}

function PatientProfileDrawer({
  patientId,
  onClose,
}: {
  patientId: string
  onClose: () => void
}) {
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => apiRequest<PatientSummary>(`/patients/${patientId}`),
  })
  const { data: qrCard } = useQuery({
    queryKey: ['patient-qr-card', patientId],
    queryFn: () =>
      apiRequest<{
        patientNo: string
        qrCode: string
        qrDataUrl: string
        printableText: string
      }>(`/patients/${patientId}/qr-card`),
  })

  const allergyText = useMemo(
    () =>
      patient?.allergies?.length
        ? patient.allergies.map((allergy) => allergy.allergen).join(', ')
        : 'No allergies recorded',
    [patient?.allergies],
  )

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
      {isLoading || !patient ? (
        <p className="text-slate-500">Loading patient profile...</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">
                Patient profile
              </p>
              <h3 className="text-2xl font-bold">
                {patient.firstName} {patient.lastName}
              </h3>
              <p className="text-sm text-slate-500">
                {patient.patientNo} · {patient.gender} · DOB{' '}
                {patient.dateOfBirth}
              </p>
            </div>
            <button
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-red-50 p-4 text-red-800">
              <p className="text-xs font-bold uppercase">Allergies</p>
              <p className="text-sm">{allergyText}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-amber-900">
              <p className="text-xs font-bold uppercase">Chronic conditions</p>
              <p className="text-sm">
                {patient.chronicConditions
                  ?.map((condition) => condition.name)
                  .join(', ') || 'None recorded'}
              </p>
            </div>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">
                  Printable QR card
                </p>
                <p className="font-semibold">{qrCard?.printableText}</p>
              </div>
              <Printer className="text-blue-600" />
            </div>
            {qrCard?.qrDataUrl ? (
              <img
                src={qrCard.qrDataUrl}
                alt={`QR code for ${patient.patientNo}`}
                className="mt-4 h-32 w-32 rounded-xl border border-slate-200"
              />
            ) : null}
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <ProfileSection title="Identifiers">
              {patient.identifiers?.map((identifier) => (
                <p key={`${identifier.type}-${identifier.value}`}>
                  {identifier.type}: {identifier.value}
                </p>
              )) || <p>None recorded</p>}
            </ProfileSection>
            <ProfileSection title="Next of kin">
              {patient.nextOfKin?.map((kin) => (
                <p key={`${kin.name}-${kin.primaryPhone}`}>
                  {kin.name} ({kin.relationship}) · {kin.primaryPhone}
                </p>
              )) || <p>None recorded</p>}
            </ProfileSection>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">
              Contact
            </p>
            <p className="mt-2 text-sm">
              Phone: {patient.primaryPhone}
              {patient.bloodGroup ? ` · Blood group: ${patient.bloodGroup}` : ''}
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function ProfileSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-700">{children}</div>
    </div>
  )
}

function SafetyPanel() {
  return (
    <div className="rounded-3xl bg-blue-950 p-6 text-white shadow-sm">
      <Activity className="mb-4 text-blue-200" />
      <h3 className="text-xl font-bold">Phase 1 safety rules</h3>
      <ul className="mt-4 space-y-3 text-sm text-blue-100">
        <li>Search before registration to avoid duplicate records.</li>
        <li>At least one identifier and one phone number are mandatory.</li>
        <li>Every mutating action is audited.</li>
        <li>Clinical data uses soft delete only.</li>
      </ul>
    </div>
  )
}

function Placeholder({ screen }: { screen: string }) {
  return (
    <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
      <ClipboardList className="mx-auto mb-4 text-blue-600" size={40} />
      <h3 className="text-xl font-bold">{screen}</h3>
      <p className="mt-2 text-slate-500">
        This area is reserved for the next blueprint phase.
      </p>
    </div>
  )
}

export default App
