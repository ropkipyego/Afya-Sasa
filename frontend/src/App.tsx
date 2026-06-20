import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Hospital,
  KeyRound,
  LogOut,
  Printer,
  Settings,
  Search,
  ShieldCheck,
  Users,
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
  { label: 'OPD Check-In', icon: ClipboardList, permission: 'encounters:create' },
  { label: 'Triage Queue', icon: Activity, permission: 'triage:read' },
  { label: 'Doctor Queue', icon: Hospital, permission: 'consultations:read' },
  { label: 'Appointments', icon: CalendarDays, permission: 'appointments:read' },
  { label: 'OPD Reports', icon: ClipboardList, permission: 'reports:read' },
  { label: 'User Management', icon: Users, permission: 'users:manage' },
  { label: 'Role Permissions', icon: ShieldCheck, permission: 'roles:manage' },
  { label: 'Settings', icon: Settings, permission: 'settings:manage' },
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
          {activeScreen === 'OPD Check-In' ? <OpdCheckIn /> : null}
          {activeScreen === 'Triage Queue' ? <TriageQueue /> : null}
          {activeScreen === 'Doctor Queue' ? <DoctorQueue /> : null}
          {activeScreen === 'Appointments' ? <AppointmentsScreen /> : null}
          {activeScreen === 'OPD Reports' ? <OpdReports /> : null}
          {activeScreen === 'User Management' ? <AdminUsers /> : null}
          {activeScreen === 'Role Permissions' ? <AdminRoles /> : null}
          {activeScreen === 'Settings' ? <AdminSettings /> : null}
          {activeScreen === 'Audit' ? <AuditLogViewer /> : null}
          {activeScreen !== 'Patient Search' &&
          activeScreen !== 'Register Patient' &&
          activeScreen !== 'OPD Check-In' &&
          activeScreen !== 'Triage Queue' &&
          activeScreen !== 'Doctor Queue' &&
          activeScreen !== 'Appointments' &&
          activeScreen !== 'OPD Reports' &&
          activeScreen !== 'User Management' &&
          activeScreen !== 'Role Permissions' &&
          activeScreen !== 'Settings' &&
          activeScreen !== 'Audit' ? (
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
  const queryClient = useQueryClient()
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
  const addIdentifier = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/patients/${patientId}/identifiers`, {
        method: 'POST',
        body: JSON.stringify({
          type: form.get('type'),
          value: form.get('value'),
          isPrimary: false,
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    },
  })
  const addNok = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/patients/${patientId}/next-of-kin`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          relationship: form.get('relationship'),
          primaryPhone: form.get('primaryPhone'),
          isEmergencyContact: true,
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    },
  })
  const addAllergy = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/patients/${patientId}/allergies`, {
        method: 'POST',
        body: JSON.stringify({
          allergen: form.get('allergen'),
          type: form.get('type'),
          reaction: form.get('reaction'),
          severity: form.get('severity'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    },
  })
  const addCondition = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/patients/${patientId}/chronic-conditions`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          icd10Code: form.get('icd10Code'),
          status: form.get('status'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    },
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
            <button
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              onClick={() => window.print()}
            >
              Print card
            </button>
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

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <QuickAddForm
              title="Add identifier"
              pending={addIdentifier.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                addIdentifier.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <select name="type" className="input" required>
                <option value="national_id">National ID</option>
                <option value="sha">SHA</option>
                <option value="passport">Passport</option>
                <option value="birth_certificate">Birth certificate</option>
                <option value="refugee_id">Refugee ID</option>
              </select>
              <input name="value" className="input" placeholder="Value" required />
            </QuickAddForm>
            <QuickAddForm
              title="Add next of kin"
              pending={addNok.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                addNok.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <input name="name" className="input" placeholder="Name" required />
              <input
                name="relationship"
                className="input"
                placeholder="Relationship"
                required
              />
              <input
                name="primaryPhone"
                className="input"
                placeholder="Phone"
                required
              />
            </QuickAddForm>
            <QuickAddForm
              title="Add allergy"
              pending={addAllergy.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                addAllergy.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <input
                name="allergen"
                className="input"
                placeholder="Allergen"
                required
              />
              <select name="type" className="input" required>
                <option value="drug">Drug</option>
                <option value="food">Food</option>
                <option value="environmental">Environmental</option>
                <option value="latex">Latex</option>
                <option value="contrast">Contrast</option>
              </select>
              <input
                name="reaction"
                className="input"
                placeholder="Reaction"
                required
              />
              <select name="severity" className="input" required>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="life_threatening">Life threatening</option>
              </select>
            </QuickAddForm>
            <QuickAddForm
              title="Add chronic condition"
              pending={addCondition.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                addCondition.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <input name="name" className="input" placeholder="Name" required />
              <input
                name="icd10Code"
                className="input"
                placeholder="ICD-10 code"
              />
              <select name="status" className="input" required>
                <option value="active">Active</option>
                <option value="controlled">Controlled</option>
                <option value="resolved">Resolved</option>
              </select>
            </QuickAddForm>
          </section>
        </>
      )}
    </div>
  )
}

function QuickAddForm({
  title,
  pending,
  onSubmit,
  children,
}: {
  title: string
  pending: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
}) {
  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 p-4"
      onSubmit={onSubmit}
    >
      <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
      {children}
      <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
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

interface EncounterItem {
  id: string
  encounterNo: string
  status: string
  presentingComplaint: string
  startedAt: string
  patient: PatientSummary
  triage?: { colour: string; chiefComplaint: string } | null
  consultation?: { id: string; status: string } | null
}

function OpdCheckIn() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PatientSummary | null>(null)
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['opd-checkin-patients', query],
    queryFn: () =>
      apiRequest<PatientSearchResponse>(
        `/patients?q=${encodeURIComponent(query)}`,
      ),
    enabled: false,
  })
  const createEncounter = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/opd/encounters', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selected?.id,
          presentingComplaint: form.get('presentingComplaint'),
          visitType: form.get('visitType'),
        }),
      })
    },
    onSuccess: () => setSelected(null),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Search patient for OPD check-in</h3>
        <form
          className="mt-4 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void refetch()
          }}
        >
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, patient number, phone"
          />
          <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">
            {isFetching ? 'Searching...' : 'Search'}
          </button>
        </form>
        <div className="mt-4 divide-y divide-slate-100">
          {(data?.items ?? []).map((patient) => (
            <button
              key={patient.id}
              className="w-full py-3 text-left hover:bg-slate-50"
              onClick={() => setSelected(patient)}
            >
              <p className="font-bold">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {patient.patientNo} · {patient.primaryPhone}
              </p>
            </button>
          ))}
        </div>
      </div>

      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          createEncounter.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <h3 className="text-xl font-bold">Create OPD encounter</h3>
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          {selected
            ? `${selected.firstName} ${selected.lastName} (${selected.patientNo})`
            : 'Select a patient from search results first.'}
        </p>
        <label>
          <span className="text-sm font-semibold">Visit type</span>
          <select name="visitType" className="input mt-2" required>
            <option value="new">New</option>
            <option value="follow_up">Follow-up</option>
            <option value="referral">Referral</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Presenting complaint</span>
          <textarea name="presentingComplaint" className="input mt-2" required />
        </label>
        {createEncounter.error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {createEncounter.error.message}
          </p>
        ) : null}
        {createEncounter.isSuccess ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            OPD encounter created. Patient is now in triage queue.
          </p>
        ) : null}
        <button
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
          disabled={!selected || createEncounter.isPending}
        >
          Check in patient
        </button>
      </form>
    </div>
  )
}

function TriageQueue() {
  const queryClient = useQueryClient()
  const { data: encounters = [] } = useQuery({
    queryKey: ['triage-queue'],
    queryFn: () => apiRequest<EncounterItem[]>('/opd/triage/queue'),
  })
  const triage = useMutation({
    mutationFn: ({
      event,
      encounterId,
    }: {
      event: FormEvent<HTMLFormElement>
      encounterId: string
    }) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/opd/encounters/${encounterId}/triage`, {
        method: 'POST',
        body: JSON.stringify({
          category: form.get('category'),
          colour: form.get('colour'),
          chiefComplaint: form.get('chiefComplaint'),
          painScore: Number(form.get('painScore') || 0),
          temperature: Number(form.get('temperature') || 0),
          pulse: Number(form.get('pulse') || 0),
          respiratoryRate: Number(form.get('respiratoryRate') || 0),
          bpSystolic: Number(form.get('bpSystolic') || 0),
          bpDiastolic: Number(form.get('bpDiastolic') || 0),
          spo2: Number(form.get('spo2') || 0),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['triage-queue'] })
    },
  })

  return (
    <div className="space-y-4">
      {encounters.map((encounter) => (
        <form
          key={encounter.id}
          className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm lg:grid-cols-[1fr_1.4fr]"
          onSubmit={(event) => {
            event.preventDefault()
            triage.mutate({ event, encounterId: encounter.id })
          }}
        >
          <div>
            <p className="text-sm font-semibold text-blue-600">
              {encounter.encounterNo}
            </p>
            <h3 className="text-xl font-bold">
              {encounter.patient.firstName} {encounter.patient.lastName}
            </h3>
            <p className="text-sm text-slate-500">
              {encounter.presentingComplaint}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input name="category" className="input" placeholder="Category" required />
            <select name="colour" className="input" required>
              <option value="red">Red</option>
              <option value="orange">Orange</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
            </select>
            <input name="painScore" className="input" placeholder="Pain 0-10" />
            <input
              name="chiefComplaint"
              className="input md:col-span-3"
              placeholder="Chief complaint"
              required
            />
            <input name="temperature" className="input" placeholder="Temp" />
            <input name="pulse" className="input" placeholder="Pulse" />
            <input name="respiratoryRate" className="input" placeholder="Resp" />
            <input name="bpSystolic" className="input" placeholder="BP sys" />
            <input name="bpDiastolic" className="input" placeholder="BP dia" />
            <input name="spo2" className="input" placeholder="SpO2" />
            <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white md:col-span-3">
              Submit triage
            </button>
          </div>
        </form>
      ))}
      {!encounters.length ? (
        <p className="rounded-3xl bg-white p-10 text-center text-slate-500">
          No patients waiting for triage.
        </p>
      ) : null}
    </div>
  )
}

function DoctorQueue() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<EncounterItem | null>(null)
  const { data: queue = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => apiRequest<EncounterItem[]>('/opd/doctor/queue'),
  })
  const createConsultation = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest<{ id: string }>(`/opd/encounters/${selected?.id}/consultations`, {
        method: 'POST',
        body: JSON.stringify({
          subjective: form.get('subjective'),
          objective: form.get('objective'),
          assessment: form.get('assessment'),
          plan: form.get('plan'),
          followUpDate: form.get('followUpDate') || undefined,
          followUpInstructions: form.get('followUpInstructions') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
  })
  const addDiagnosis = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/opd/encounters/${selected?.id}/diagnoses`, {
        method: 'POST',
        body: JSON.stringify({
          icd10Code: form.get('icd10Code'),
          description: form.get('description'),
          type: form.get('type'),
          confirmed: true,
        }),
      })
    },
  })
  const completeEncounter = useMutation({
    mutationFn: () =>
      apiRequest(`/opd/encounters/${selected?.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      }),
    onSuccess: async () => {
      setSelected(null)
      await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-3">
        {queue.map((encounter) => (
          <button
            key={encounter.id}
            className="w-full rounded-3xl bg-white p-5 text-left shadow-sm hover:ring-2 hover:ring-blue-200"
            onClick={() => setSelected(encounter)}
          >
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
              {encounter.triage?.colour ?? 'untriaged'}
            </span>
            <h3 className="mt-3 text-lg font-bold">
              {encounter.patient.firstName} {encounter.patient.lastName}
            </h3>
            <p className="text-sm text-slate-500">
              {encounter.presentingComplaint}
            </p>
          </button>
        ))}
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        {selected ? (
          <>
            <h3 className="text-xl font-bold">
              Consultation: {selected.patient.firstName}{' '}
              {selected.patient.lastName}
            </h3>
            <PatientSafetyBanner patient={selected.patient} />
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                createConsultation.mutate(event)
              }}
            >
              <textarea name="subjective" className="input" placeholder="Subjective" required />
              <textarea name="objective" className="input" placeholder="Objective" required />
              <textarea name="assessment" className="input" placeholder="Assessment" required />
              <textarea name="plan" className="input" placeholder="Plan" required />
              <input name="followUpDate" className="input" type="date" />
              <input
                name="followUpInstructions"
                className="input"
                placeholder="Follow-up instructions"
              />
              <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">
                Save SOAP
              </button>
            </form>
            <form
              className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                addDiagnosis.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <p className="font-bold">Add diagnosis</p>
              <input name="icd10Code" className="input" placeholder="ICD-10" />
              <input name="description" className="input" placeholder="Diagnosis" required />
              <select name="type" className="input" required>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="differential">Differential</option>
              </select>
              <button className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">
                Add diagnosis
              </button>
            </form>
            <button
              className="mt-6 rounded-xl bg-green-600 px-4 py-2 font-bold text-white"
              onClick={() => completeEncounter.mutate()}
            >
              Complete encounter
            </button>
          </>
        ) : (
          <p className="text-slate-500">Select a patient from the doctor queue.</p>
        )}
      </div>
    </div>
  )
}

function PatientSafetyBanner({ patient }: { patient: PatientSummary }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl bg-red-50 p-3 text-red-800">
        <p className="text-xs font-bold uppercase">Allergies</p>
        <p className="text-sm">
          {patient.allergies?.map((allergy) => allergy.allergen).join(', ') ||
            'None recorded'}
        </p>
      </div>
      <div className="rounded-2xl bg-amber-50 p-3 text-amber-900">
        <p className="text-xs font-bold uppercase">Chronic conditions</p>
        <p className="text-sm">
          {patient.chronicConditions?.map((condition) => condition.name).join(', ') ||
            'None recorded'}
        </p>
      </div>
    </div>
  )
}

function AppointmentsScreen() {
  const queryClient = useQueryClient()
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiRequest<unknown[]>('/appointments'),
  })
  const createAppointment = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: form.get('patientId'),
          doctorId: form.get('doctorId'),
          appointmentDate: form.get('appointmentDate'),
          appointmentTime: form.get('appointmentTime'),
          type: form.get('type'),
          reason: form.get('reason'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          createAppointment.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <h3 className="text-xl font-bold">Book appointment</h3>
        <Field name="patientId" label="Patient ID" required />
        <Field name="doctorId" label="Doctor user ID" required />
        <Field name="appointmentDate" label="Date" type="date" required />
        <Field name="appointmentTime" label="Time" required />
        <label>
          <span className="text-sm font-semibold">Type</span>
          <select name="type" className="input mt-2" required>
            <option value="new">New</option>
            <option value="follow_up">Follow-up</option>
            <option value="procedure">Procedure</option>
            <option value="review">Review</option>
            <option value="antenatal">Antenatal</option>
          </select>
        </label>
        <Field name="reason" label="Reason" required />
        <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
          Book appointment
        </button>
      </form>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Appointments</h3>
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-50">
          {JSON.stringify(appointments, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function OpdReports() {
  const { data } = useQuery({
    queryKey: ['opd-summary'],
    queryFn: () =>
      apiRequest<{
        totalVisits: number
        activeVisits: number
        completedVisits: number
        topDiagnoses: { description: string; count: number }[]
      }>('/opd/reports/summary'),
  })

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <MetricCard label="Total OPD visits" value={data?.totalVisits ?? 0} />
      <MetricCard label="Active visits" value={data?.activeVisits ?? 0} />
      <MetricCard label="Completed visits" value={data?.completedVisits ?? 0} />
      <div className="rounded-3xl bg-white p-6 shadow-sm md:col-span-3">
        <h3 className="text-xl font-bold">Top diagnoses</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {(data?.topDiagnoses ?? []).map((diagnosis) => (
            <div key={diagnosis.description} className="flex justify-between py-3">
              <span>{diagnosis.description}</span>
              <span className="font-bold">{diagnosis.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

interface RoleItem {
  id: string
  name: string
  label: string
  permissions?: { id: string; permissionKey: string }[]
}

interface AdminUserItem {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  email: string
  active: boolean
  roles: RoleItem[]
}

function AdminUsers() {
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserItem[]>('/admin/users'),
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/roles'),
  })
  const createUser = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      const roleId = form.get('roleId')?.toString()
      return apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          employeeNo: form.get('employeeNo'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          email: form.get('email'),
          phone: form.get('phone'),
          temporaryPassword: form.get('temporaryPassword'),
          roleIds: roleId ? [roleId] : [],
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          createUser.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <h3 className="text-xl font-bold">Create staff user</h3>
        <Field name="employeeNo" label="Employee no." required />
        <Field name="firstName" label="First name" required />
        <Field name="lastName" label="Last name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="phone" label="Phone" />
        <Field
          name="temporaryPassword"
          label="Temporary password"
          type="password"
          required
        />
        <label>
          <span className="text-sm font-semibold">Role</span>
          <select name="roleId" className="input mt-2">
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
          {createUser.isPending ? 'Creating...' : 'Create user'}
        </button>
      </form>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Users</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {users.map((user) => (
            <div key={user.id} className="py-4">
              <p className="font-bold">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {user.employeeNo} · {user.email} ·{' '}
                {user.active ? 'active' : 'inactive'}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                {user.roles.map((role) => role.label).join(', ') || 'No roles'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminRoles() {
  const queryClient = useQueryClient()
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<RoleItem[]>('/admin/roles'),
  })
  const { data: permissions = [] } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () =>
      apiRequest<{ id: string; permissionKey: string; description?: string }[]>(
        '/admin/permissions',
      ),
  })
  const createRole = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          label: form.get('label'),
          description: form.get('description'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          createRole.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <h3 className="text-xl font-bold">Create role</h3>
        <Field name="name" label="Role key" required />
        <Field name="label" label="Display label" required />
        <Field name="description" label="Description" />
        <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
          {createRole.isPending ? 'Creating...' : 'Create role'}
        </button>
      </form>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Roles and permissions</h3>
        <div className="mt-4 space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="rounded-2xl border border-slate-200 p-4">
              <p className="font-bold">{role.label}</p>
              <p className="text-sm text-slate-500">{role.name}</p>
              <p className="mt-2 text-xs text-slate-500">
                {(role.permissions ?? [])
                  .map((permission) => permission.permissionKey)
                  .join(', ') || 'No permissions'}
              </p>
            </div>
          ))}
        </div>
        <details className="mt-6 rounded-2xl bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold">
            Available permissions
          </summary>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {permissions.map((permission) => (
              <span key={permission.id} className="rounded-lg bg-white p-2">
                {permission.permissionKey}
              </span>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}

function AdminSettings() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiRequest<{
        smsSenderName: string
        patientIdPrefix: string
        triageSystem: string
      }>('/admin/settings'),
  })
  const update = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          smsSenderName: form.get('smsSenderName'),
          patientIdPrefix: form.get('patientIdPrefix'),
          triageSystem: form.get('triageSystem'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })

  return (
    <form
      className="max-w-2xl space-y-4 rounded-3xl bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault()
        update.mutate(event)
      }}
    >
      <h3 className="text-xl font-bold">Hospital settings</h3>
      <label>
        <span className="text-sm font-semibold">SMS sender name</span>
        <input
          name="smsSenderName"
          className="input mt-2"
          defaultValue={data?.smsSenderName}
        />
      </label>
      <label>
        <span className="text-sm font-semibold">Patient ID prefix</span>
        <input
          name="patientIdPrefix"
          className="input mt-2"
          defaultValue={data?.patientIdPrefix}
        />
      </label>
      <label>
        <span className="text-sm font-semibold">Triage system</span>
        <input
          name="triageSystem"
          className="input mt-2"
          defaultValue={data?.triageSystem}
        />
      </label>
      <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
        {update.isPending ? 'Saving...' : 'Save settings'}
      </button>
    </form>
  )
}

function AuditLogViewer() {
  const { data } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () =>
      apiRequest<{
        items: {
          id: string
          action: string
          endpoint: string
          httpCode: number
          createdAt: string
        }[]
      }>('/admin/audit-logs'),
  })

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">Audit logs</h3>
      <div className="mt-4 divide-y divide-slate-100">
        {(data?.items ?? []).map((entry) => (
          <div key={entry.id} className="py-3 text-sm">
            <p className="font-semibold">
              {entry.action.toUpperCase()} · {entry.httpCode}
            </p>
            <p className="text-slate-500">{entry.endpoint}</p>
            <p className="text-xs text-slate-400">{entry.createdAt}</p>
          </div>
        ))}
      </div>
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
