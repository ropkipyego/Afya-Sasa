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
  { group: 'Reception', label: 'Patient Search', icon: Search, permission: 'patients:read' },
  { group: 'Reception', label: 'Register Patient', icon: UserPlus, permission: 'patients:create' },
  { group: 'Outpatient', label: 'OPD Check-In', icon: ClipboardList, permission: 'encounters:create' },
  { group: 'Outpatient', label: 'Triage Queue', icon: Activity, permission: 'triage:read' },
  { group: 'Outpatient', label: 'Doctor Queue', icon: Hospital, permission: 'consultations:read' },
  { group: 'Outpatient', label: 'Appointments', icon: CalendarDays, permission: 'appointments:read' },
  { group: 'Outpatient', label: 'Referrals', icon: ClipboardList, permission: 'referrals:read' },
  { group: 'Investigations', label: 'Laboratory', icon: Activity, permission: 'lab_requests:read' },
  { group: 'Investigations', label: 'Radiology', icon: Hospital, permission: 'radiology_requests:read' },
  { group: 'Investigations', label: 'Results Inbox', icon: ClipboardList, permission: 'lab_results:read' },
  { group: 'Inpatient', label: 'Bed Dashboard', icon: Hospital, permission: 'beds:read' },
  { group: 'Inpatient', label: 'Admissions', icon: ClipboardList, permission: 'admissions:read' },
  { group: 'Inpatient', label: 'Nursing', icon: Activity, permission: 'vitals:read' },
  { group: 'Emergency & Critical Care', label: 'Emergency', icon: AlertTriangle, permission: 'emergency:read' },
  { group: 'Emergency & Critical Care', label: 'ICU', icon: AlertTriangle, permission: 'icu_admissions:read' },
  { group: 'Emergency & Critical Care', label: 'HDU', icon: Activity, permission: 'hdu_admissions:read' },
  { group: 'Specialty', label: 'Theatre', icon: Hospital, permission: 'surgery_bookings:read' },
  { group: 'Specialty', label: 'Maternity', icon: Activity, permission: 'pregnancies:read' },
  { group: 'Reports', label: 'OPD Reports', icon: ClipboardList, permission: 'reports:read' },
  { group: 'Reports', label: 'Clinical Reports', icon: ClipboardList, permission: 'reports:read' },
  { group: 'Administration', label: 'User Management', icon: Users, permission: 'users:manage' },
  { group: 'Administration', label: 'Role Permissions', icon: ShieldCheck, permission: 'roles:manage' },
  { group: 'Administration', label: 'Settings', icon: Settings, permission: 'settings:manage' },
  { group: 'Administration', label: 'Audit', icon: ShieldCheck, permission: 'audit_logs:read' },
]

const workflowDescriptions: Record<string, string> = {
  'Patient Search': 'Find existing patients first, then open their safety banner and profile.',
  'Register Patient': 'Create a new patient only after search-first duplicate checks.',
  'OPD Check-In': 'Select a patient and create today’s outpatient encounter.',
  'Triage Queue': 'Record vitals and triage colour before doctor review.',
  'Doctor Queue': 'Prioritised queue with SOAP notes, diagnosis entry, and completion.',
  'Bed Dashboard': 'Ward and bed map with live-style status cards.',
  Admissions: 'Admit selected patients into available beds and review current admissions.',
  Settings: 'Hospital-level configuration for patient numbers, triage, and messaging.',
}

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
  const groupedNavigation = allowedNavigation.reduce(
    (groups, item) => {
      groups[item.group] = [...(groups[item.group] ?? []), item]
      return groups
    },
    {} as Record<string, typeof allowedNavigation>,
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-80 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="shrink-0 p-6 pb-4">
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

        <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Tenant</p>
          <p>{tenant}</p>
        </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {Object.entries(groupedNavigation).map(([group, items]) => (
            <div key={group}>
              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {group}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.label}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                        activeScreen === item.label
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setActiveScreen(item.label)}
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-h-screen lg:pl-80">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">
                {workflowDescriptions[activeScreen] ?? 'Clinical workflow workspace'}
              </p>
              <h2 className="text-2xl font-bold">{activeScreen}</h2>
            </div>
            <select
              className="input max-w-xs lg:hidden"
              value={activeScreen}
              onChange={(event) => setActiveScreen(event.target.value)}
            >
              {allowedNavigation.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.group} / {item.label}
                </option>
              ))}
            </select>
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

        <section className="min-h-[calc(100vh-5rem)] overflow-x-hidden p-4 md:p-6">
          {activeScreen === 'Patient Search' ? (
            <PatientSearch onSelect={(patient) => setSelectedPatientId(patient.id)} />
          ) : null}
          {activeScreen === 'Register Patient' ? <PatientRegistration /> : null}
          {activeScreen === 'OPD Check-In' ? <OpdCheckIn /> : null}
          {activeScreen === 'Triage Queue' ? <TriageQueue /> : null}
          {activeScreen === 'Doctor Queue' ? <DoctorQueue /> : null}
          {activeScreen === 'Laboratory' ? <LaboratoryScreen /> : null}
          {activeScreen === 'Radiology' ? <RadiologyScreen /> : null}
          {activeScreen === 'Results Inbox' ? <ResultsInbox /> : null}
          {activeScreen === 'Appointments' ? <AppointmentsScreen /> : null}
          {activeScreen === 'Referrals' ? <ReferralsScreen /> : null}
          {activeScreen === 'OPD Reports' ? <OpdReports /> : null}
          {activeScreen === 'Bed Dashboard' ? <BedDashboard /> : null}
          {activeScreen === 'Admissions' ? <AdmissionsScreen /> : null}
          {activeScreen === 'Emergency' ? <EmergencyScreen /> : null}
          {activeScreen === 'Nursing' ? <NursingScreen /> : null}
          {activeScreen === 'Clinical Reports' ? <ClinicalReports /> : null}
          {activeScreen === 'Theatre' ? <TheatreScreen /> : null}
          {activeScreen === 'Maternity' ? <MaternityScreen /> : null}
          {activeScreen === 'ICU' ? <IcuScreen /> : null}
          {activeScreen === 'HDU' ? <HduScreen /> : null}
          {activeScreen === 'User Management' ? <AdminUsers /> : null}
          {activeScreen === 'Role Permissions' ? <AdminRoles /> : null}
          {activeScreen === 'Settings' ? <AdminSettings /> : null}
          {activeScreen === 'Audit' ? <AuditLogViewer /> : null}
          {activeScreen !== 'Patient Search' &&
          activeScreen !== 'Register Patient' &&
          activeScreen !== 'OPD Check-In' &&
          activeScreen !== 'Triage Queue' &&
          activeScreen !== 'Doctor Queue' &&
          activeScreen !== 'Laboratory' &&
          activeScreen !== 'Radiology' &&
          activeScreen !== 'Results Inbox' &&
          activeScreen !== 'Appointments' &&
          activeScreen !== 'Referrals' &&
          activeScreen !== 'OPD Reports' &&
          activeScreen !== 'Bed Dashboard' &&
          activeScreen !== 'Admissions' &&
          activeScreen !== 'Emergency' &&
          activeScreen !== 'Nursing' &&
          activeScreen !== 'Clinical Reports' &&
          activeScreen !== 'Theatre' &&
          activeScreen !== 'Maternity' &&
          activeScreen !== 'ICU' &&
          activeScreen !== 'HDU' &&
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

function PatientLookup({
  selectedPatient,
  onSelect,
}: {
  selectedPatient: PatientSummary | null
  onSelect: (patient: PatientSummary | null) => void
}) {
  const [query, setQuery] = useState('')
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['patient-lookup', query],
    queryFn: () =>
      apiRequest<PatientSearchResponse>(
        `/patients?q=${encodeURIComponent(query)}`,
      ),
    enabled: false,
  })

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-semibold">Patient</p>
      <div className="mt-3 flex gap-2">
        <input
          className="input"
          placeholder="Search name, patient no, phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          onClick={() => void refetch()}
        >
          {isFetching ? 'Searching...' : 'Search'}
        </button>
      </div>
      <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-slate-200">
        {(data?.items ?? []).map((patient) => (
          <button
            type="button"
            key={patient.id}
            className={`w-full px-2 py-3 text-left text-sm hover:bg-white ${
              selectedPatient?.id === patient.id
                ? 'bg-white font-semibold text-blue-700'
                : ''
            }`}
            onClick={() => onSelect(patient)}
          >
            {patient.firstName} {patient.lastName} · {patient.patientNo} ·{' '}
            {patient.primaryPhone}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3 text-sm">
        <span>
          Selected:{' '}
          {selectedPatient
            ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.patientNo})`
            : 'none'}
        </span>
        {selectedPatient ? (
          <button
            type="button"
            className="font-semibold text-red-600"
            onClick={() => onSelect(null)}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
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
  const { data: timeline } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () =>
      apiRequest<{
        events: {
          type: string
          occurredAt: string
          title: string
          summary: string
        }[]
      }>(`/patients/${patientId}/timeline`),
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
              Clinical timeline
            </p>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
              {(timeline?.events ?? []).map((event, index) => (
                <div key={`${event.type}-${event.occurredAt}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{event.title}</p>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold uppercase text-blue-700">
                      {event.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{event.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {!timeline?.events?.length ? (
                <p className="text-sm text-slate-500">No timeline events yet.</p>
              ) : null}
            </div>
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
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null)
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
          patientId: selectedPatient?.id,
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
        <PatientLookup
          selectedPatient={selectedPatient}
          onSelect={setSelectedPatient}
        />
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
        {createAppointment.error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {createAppointment.error.message}
          </p>
        ) : null}
        {createAppointment.isSuccess ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Appointment booked.
          </p>
        ) : null}
        <button
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!selectedPatient || createAppointment.isPending}
        >
          {createAppointment.isPending ? 'Booking...' : 'Book appointment'}
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

function ReferralsScreen() {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null)
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => apiRequest<unknown[]>('/referrals'),
  })
  const createReferral = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          encounterId: form.get('encounterId') || undefined,
          type: form.get('type'),
          receivingUserId: form.get('receivingUserId') || undefined,
          targetDepartment: form.get('targetDepartment') || undefined,
          targetFacility: form.get('targetFacility') || undefined,
          reason: form.get('reason'),
          letter: form.get('letter'),
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['referrals'] }),
  })
  const updateReferral = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/referrals/${form.get('referralId')}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.get('status') }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['referrals'] }),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-6">
        <QuickAddForm
          title="Create referral"
          pending={createReferral.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createReferral.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <PatientLookup selectedPatient={selectedPatient} onSelect={setSelectedPatient} />
          <input name="encounterId" className="input" placeholder="Encounter ID" />
          <select name="type" className="input" required>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
          <input name="receivingUserId" className="input" placeholder="Receiving clinician user ID" />
          <input name="targetDepartment" className="input" placeholder="Target department" />
          <input name="targetFacility" className="input" placeholder="Target facility" />
          <input name="reason" className="input" placeholder="Reason" required />
          <textarea name="letter" className="input" placeholder="Referral letter" required />
        </QuickAddForm>
        <QuickAddForm
          title="Update referral status"
          pending={updateReferral.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            updateReferral.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="referralId" className="input" placeholder="Referral ID" required />
          <select name="status" className="input" required>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </QuickAddForm>
      </div>
      <JsonPanel title="Referrals" data={referrals} />
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

interface ReportPayload {
  generatedAt: string
  data: unknown
  csv: string
}

const reportDefinitions = [
  { key: 'opd-summary', title: 'OPD Summary' },
  { key: 'admissions', title: 'Admissions' },
  { key: 'discharges', title: 'Discharges' },
  { key: 'bed-occupancy', title: 'Bed Occupancy' },
  { key: 'emergency-stats', title: 'Emergency Stats' },
  { key: 'disease-register', title: 'Disease Register' },
  { key: 'moh-705', title: 'MOH 705 Draft' },
]

function ClinicalReports() {
  const [selectedReport, setSelectedReport] = useState('opd-summary')
  const { data: dashboard } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () =>
      apiRequest<{
        totalPatients: number
        activeOpd: number
        activeAdmissions: number
        occupiedBeds: number
        activeEmergency: number
        activeAlerts: number
        todayAppointments: number
      }>('/reports/dashboard'),
  })
  const { data: report, isFetching } = useQuery({
    queryKey: ['clinical-report', selectedReport],
    queryFn: () => apiRequest<ReportPayload>(`/reports/${selectedReport}`),
  })

  function downloadCsv() {
    if (!report?.csv) return
    const blob = new Blob([report.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedReport}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Patients" value={dashboard?.totalPatients ?? 0} />
        <MetricCard label="Active OPD" value={dashboard?.activeOpd ?? 0} />
        <MetricCard
          label="Admissions"
          value={dashboard?.activeAdmissions ?? 0}
        />
        <MetricCard label="Occupied beds" value={dashboard?.occupiedBeds ?? 0} />
        <MetricCard
          label="Emergency"
          value={dashboard?.activeEmergency ?? 0}
        />
        <MetricCard label="Alerts" value={dashboard?.activeAlerts ?? 0} />
        <MetricCard
          label="Appointments today"
          value={dashboard?.todayAppointments ?? 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.35fr_0.65fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Report library</h3>
          <div className="mt-4 space-y-2">
            {reportDefinitions.map((definition) => (
              <button
                key={definition.key}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                  selectedReport === definition.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setSelectedReport(definition.key)}
              >
                {definition.title}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Generated {report?.generatedAt ?? '-'}
              </p>
              <h3 className="text-xl font-bold">
                {reportDefinitions.find((item) => item.key === selectedReport)
                  ?.title ?? selectedReport}
              </h3>
            </div>
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              onClick={downloadCsv}
            >
              Download CSV
            </button>
          </div>
          <pre className="mt-4 max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-50">
            {isFetching ? 'Loading...' : JSON.stringify(report?.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function BedDashboard() {
  const queryClient = useQueryClient()
  const { data: beds = [] } = useQuery({
    queryKey: ['bed-dashboard'],
    queryFn: () =>
      apiRequest<
        {
          id: string
          bedNo: string
          status: string
          type: string
          ward: { name: string }
          patient?: PatientSummary | null
        }[]
      >('/inpatient/beds/dashboard'),
  })
  const { data: wards = [] } = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/inpatient/wards'),
  })
  const createWard = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/inpatient/wards', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          type: form.get('type'),
          floor: form.get('floor'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wards'] })
    },
  })
  const createBed = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/inpatient/beds', {
        method: 'POST',
        body: JSON.stringify({
          wardId: form.get('wardId'),
          bedNo: form.get('bedNo'),
          type: form.get('type'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['wards'] })
    },
  })
  const updateBedStatus = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/inpatient/beds/${form.get('bedId')}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.get('status') }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
    },
  })
  const occupiedBeds = beds.filter((bed) => bed.status === 'occupied').length
  const availableBeds = beds.filter((bed) => bed.status === 'available').length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total beds" value={beds.length} />
        <MetricCard label="Available" value={availableBeds} />
        <MetricCard label="Occupied" value={occupiedBeds} />
        <MetricCard
          label="Occupancy %"
          value={beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="space-y-3 rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault()
            createWard.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <h3 className="text-xl font-bold">Create ward</h3>
          <p className="text-sm text-slate-500">
            Start inpatient setup here. Wards can be General, Maternity, ICU, HDU, or specialty wards.
          </p>
          <Field name="name" label="Ward name" required />
          <Field name="code" label="Ward code" required />
          <label>
            <span className="text-sm font-semibold">Type</span>
            <select name="type" className="input mt-2" required>
              <option value="general">General</option>
              <option value="icu">ICU</option>
              <option value="hdu">HDU</option>
              <option value="maternity">Maternity</option>
              <option value="paediatric">Paediatric</option>
              <option value="surgical">Surgical</option>
              <option value="medical">Medical</option>
              <option value="isolation">Isolation</option>
            </select>
          </label>
          <Field name="floor" label="Floor" />
          <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">
            Create ward
          </button>
        </form>
        <form
          className="space-y-3 rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault()
            createBed.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <h3 className="text-xl font-bold">Create bed</h3>
          <p className="text-sm text-slate-500">
            Beds created here become selectable in the Admissions screen.
          </p>
          <label>
            <span className="text-sm font-semibold">Ward</span>
            <select name="wardId" className="input mt-2" required>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </label>
          <Field name="bedNo" label="Bed no." required />
          <select name="type" className="input" required>
            <option value="standard">Standard</option>
            <option value="icu">ICU</option>
            <option value="isolation">Isolation</option>
            <option value="paediatric">Paediatric</option>
            <option value="maternity">Maternity</option>
            <option value="cardiac">Cardiac</option>
          </select>
          <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">
            Create bed
          </button>
        </form>
        <form
          className="space-y-3 rounded-3xl bg-white p-6 shadow-sm md:col-span-2"
          onSubmit={(event) => {
            event.preventDefault()
            updateBedStatus.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <h3 className="text-xl font-bold">Update bed status</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <select name="bedId" className="input" required>
              <option value="">Select bed</option>
              {beds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.ward?.name} · {bed.bedNo} · {bed.status}
                </option>
              ))}
            </select>
            <select name="status" className="input" required>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="cleaning">Cleaning</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <button className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">
              Update status
            </button>
          </div>
        </form>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {beds.map((bed) => (
          <div key={bed.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                bed.status === 'available'
                  ? 'bg-green-50 text-green-700'
                  : bed.status === 'occupied'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {bed.status}
            </span>
            <h3 className="mt-3 text-xl font-bold">{bed.bedNo}</h3>
            <p className="text-sm text-slate-500">
              {bed.ward?.name} · {bed.type}
            </p>
            {bed.patient ? (
              <p className="mt-2 text-sm font-semibold">
                {bed.patient.firstName} {bed.patient.lastName}
              </p>
            ) : null}
          </div>
        ))}
        {!beds.length ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 md:col-span-3 xl:col-span-4">
            No beds yet. Create a ward, then create beds for that ward.
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AdmissionsScreen() {
  const queryClient = useQueryClient()
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null)
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('')
  const { data: admissions = [] } = useQuery({
    queryKey: ['admissions'],
    queryFn: () =>
      apiRequest<
        {
          id: string
          admissionNo: string
          status: string
          patient: PatientSummary
          bed: { bedNo: string }
          ward: { name: string }
        }[]
      >('/inpatient/admissions'),
  })
  const { data: beds = [] } = useQuery({
    queryKey: ['available-beds'],
    queryFn: () =>
      apiRequest<{ id: string; bedNo: string; ward: { name: string } }[]>(
        '/inpatient/beds/available',
      ),
  })
  const {
    data: patientResults,
    refetch: searchPatients,
    isFetching: searchingPatients,
  } = useQuery({
    queryKey: ['admission-patient-search', patientQuery],
    queryFn: () =>
      apiRequest<PatientSearchResponse>(
        `/patients?q=${encodeURIComponent(patientQuery)}`,
      ),
    enabled: false,
  })
  const createAdmission = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/inpatient/admissions', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          encounterId: form.get('encounterId') || undefined,
          bedId: form.get('bedId'),
          reason: form.get('reason'),
          type: form.get('type'),
        }),
      })
    },
    onSuccess: async () => {
      setSelectedPatient(null)
      await queryClient.invalidateQueries({ queryKey: ['admissions'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
    },
  })
  const addProgressNote = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/inpatient/admissions/${selectedAdmissionId}/progress-notes`, {
        method: 'POST',
        body: JSON.stringify({
          subjective: form.get('subjective'),
          objective: form.get('objective'),
          assessment: form.get('assessment'),
          plan: form.get('plan'),
        }),
      })
    },
  })
  const createDischargeSummary = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/inpatient/admissions/${selectedAdmissionId}/discharge-summary`, {
        method: 'POST',
        body: JSON.stringify({
          presentingComplaint: form.get('presentingComplaint'),
          history: form.get('history'),
          examOnAdmission: form.get('examOnAdmission'),
          investigationsSummary: form.get('investigationsSummary'),
          finalDiagnosis: form.get('finalDiagnosis'),
          treatmentGiven: form.get('treatmentGiven'),
          dischargeMeds: form.get('dischargeMeds'),
          followUpInstructions: form.get('followUpInstructions'),
          diet: form.get('diet') || undefined,
        }),
      })
    },
  })
  const completeSummary = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/inpatient/discharge-summaries/${form.get('summaryId')}/complete`, {
        method: 'POST',
      })
    },
  })
  const dischargeAdmission = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/inpatient/admissions/${selectedAdmissionId}/discharge`, {
        method: 'POST',
        body: JSON.stringify({ conditionOnDischarge: form.get('conditionOnDischarge') }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admissions'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      await queryClient.invalidateQueries({ queryKey: ['bed-dashboard'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Active admissions" value={admissions.filter((item) => item.status === 'active').length} />
        <MetricCard label="Available beds" value={beds.length} />
        <MetricCard label="All admissions" value={admissions.length} />
        <div className="rounded-3xl bg-blue-950 p-6 text-white shadow-sm">
          <p className="text-sm text-blue-200">Flow</p>
          <p className="mt-2 text-sm">
            Search patient → choose available bed → admit → bed becomes occupied.
          </p>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          createAdmission.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <h3 className="text-xl font-bold">Create admission</h3>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">1. Search and select patient</p>
          <div className="mt-3 flex gap-2">
            <input
              className="input"
              placeholder="Search name, patient no, phone"
              value={patientQuery}
              onChange={(event) => setPatientQuery(event.target.value)}
            />
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
              onClick={() => void searchPatients()}
            >
              {searchingPatients ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div className="mt-3 max-h-44 overflow-y-auto divide-y divide-slate-200">
            {(patientResults?.items ?? []).map((patient) => (
              <button
                type="button"
                key={patient.id}
                className={`w-full px-2 py-3 text-left text-sm hover:bg-white ${
                  selectedPatient?.id === patient.id ? 'bg-white font-semibold text-blue-700' : ''
                }`}
                onClick={() => setSelectedPatient(patient)}
              >
                {patient.firstName} {patient.lastName} · {patient.patientNo} · {patient.primaryPhone}
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600">
            Selected:{' '}
            {selectedPatient
              ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.patientNo})`
              : 'none'}
          </p>
        </div>
        <Field name="encounterId" label="Source encounter ID" />
        <label>
          <span className="text-sm font-semibold">2. Available bed</span>
          <select name="bedId" className="input mt-2" required>
            <option value="">Select a bed</option>
            {beds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.ward?.name} · {bed.bedNo}
              </option>
            ))}
          </select>
        </label>
        <Field name="reason" label="3. Reason for admission" required />
        <select name="type" className="input" required>
          <option value="elective">Elective</option>
          <option value="emergency">Emergency</option>
          <option value="transfer">Transfer</option>
        </select>
        {createAdmission.error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {createAdmission.error.message}
          </p>
        ) : null}
        {createAdmission.isSuccess ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Patient admitted successfully. Bed status updated.
          </p>
        ) : null}
        <button
          className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!selectedPatient || !beds.length || createAdmission.isPending}
        >
          {createAdmission.isPending ? 'Admitting...' : 'Admit patient'}
        </button>
      </form>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Admissions</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {admissions.map((admission) => (
            <div key={admission.id} className="py-4">
              <p className="font-bold">
                {admission.patient?.firstName} {admission.patient?.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {admission.admissionNo} · {admission.ward?.name} ·{' '}
                {admission.bed?.bedNo} · {admission.status}
              </p>
              <button
                className="mt-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                onClick={() => setSelectedAdmissionId(admission.id)}
              >
                Work on this admission
              </button>
            </div>
          ))}
          {!admissions.length ? (
            <p className="py-10 text-center text-slate-500">
              No admissions yet. Create wards and beds first, then admit a patient.
            </p>
          ) : null}
        </div>
      </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm xl:col-span-3">
          <h3 className="text-xl font-bold">Admission workspace</h3>
          <p className="mt-2 text-sm text-slate-500">
            Selected admission: {selectedAdmissionId || 'choose an admission above'}
          </p>
        </div>
        <QuickAddForm
          title="Add daily progress note"
          pending={addProgressNote.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            addProgressNote.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <textarea name="subjective" className="input" placeholder="Subjective" required />
          <textarea name="objective" className="input" placeholder="Objective" required />
          <textarea name="assessment" className="input" placeholder="Assessment" required />
          <textarea name="plan" className="input" placeholder="Plan" required />
          {addProgressNote.isSuccess ? <p className="text-sm text-green-700">Progress note saved.</p> : null}
        </QuickAddForm>
        <QuickAddForm
          title="Create discharge summary"
          pending={createDischargeSummary.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createDischargeSummary.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="presentingComplaint" className="input" placeholder="Presenting complaint" required />
          <textarea name="history" className="input" placeholder="History" required />
          <textarea name="examOnAdmission" className="input" placeholder="Exam on admission" required />
          <textarea name="investigationsSummary" className="input" placeholder="Investigations summary" required />
          <textarea name="finalDiagnosis" className="input" placeholder="Final diagnosis" required />
          <textarea name="treatmentGiven" className="input" placeholder="Treatment given" required />
          <textarea name="dischargeMeds" className="input" placeholder="Discharge medications" required />
          <textarea name="followUpInstructions" className="input" placeholder="Follow-up instructions" required />
          <input name="diet" className="input" placeholder="Diet advice" />
          {createDischargeSummary.data ? (
            <p className="rounded-xl bg-green-50 p-3 text-xs text-green-700">
              Summary created. Copy ID to complete: {String((createDischargeSummary.data as { id?: string }).id ?? '')}
            </p>
          ) : null}
        </QuickAddForm>
        <div className="space-y-6">
          <QuickAddForm
            title="Complete discharge summary"
            pending={completeSummary.isPending}
            onSubmit={(event) => {
              event.preventDefault()
              completeSummary.mutate(event)
              event.currentTarget.reset()
            }}
          >
            <input name="summaryId" className="input" placeholder="Discharge summary ID" required />
            {completeSummary.isSuccess ? <p className="text-sm text-green-700">Summary completed.</p> : null}
          </QuickAddForm>
          <QuickAddForm
            title="Discharge admission"
            pending={dischargeAdmission.isPending}
            onSubmit={(event) => {
              event.preventDefault()
              dischargeAdmission.mutate(event)
            }}
          >
            <select name="conditionOnDischarge" className="input" required>
              <option value="improved">Improved</option>
              <option value="same">Same</option>
              <option value="deteriorated">Deteriorated</option>
              <option value="died">Died</option>
              <option value="absconded">Absconded</option>
            </select>
            {dischargeAdmission.error ? <p className="text-sm text-red-700">{dischargeAdmission.error.message}</p> : null}
            {dischargeAdmission.isSuccess ? <p className="text-sm text-green-700">Admission discharged.</p> : null}
          </QuickAddForm>
        </div>
      </div>
    </div>
  )
}

function EmergencyScreen() {
  const queryClient = useQueryClient()
  const { data: emergencies = [] } = useQuery({
    queryKey: ['emergency-dashboard'],
    queryFn: () => apiRequest<unknown[]>('/emergency/dashboard'),
  })
  const { data: alerts = [] } = useQuery({
    queryKey: ['critical-alerts'],
    queryFn: () =>
      apiRequest<{ id: string; message: string; severity: string }[]>(
        '/emergency/alerts',
      ),
  })
  const register = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/emergency/register', {
        method: 'POST',
        body: JSON.stringify({
          patientId: form.get('patientId'),
          presentingComplaint: form.get('presentingComplaint'),
          arrivalMode: form.get('arrivalMode'),
          traumaFlag: form.get('traumaFlag') === 'on',
          traumaMechanism: form.get('traumaMechanism') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] })
    },
  })
  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/emergency/alerts/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['critical-alerts'] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          register.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <h3 className="text-xl font-bold">Emergency fast registration</h3>
        <Field name="patientId" label="Patient ID" required />
        <Field name="presentingComplaint" label="Presenting complaint" required />
        <select name="arrivalMode" className="input" required>
          <option value="walk_in">Walk-in</option>
          <option value="ambulance">Ambulance</option>
          <option value="police">Police</option>
          <option value="referral">Referral</option>
          <option value="airlift">Airlift</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input name="traumaFlag" type="checkbox" /> Trauma case
        </label>
        <Field name="traumaMechanism" label="Trauma mechanism" />
        <button className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white">
          Register emergency
        </button>
      </form>
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Emergency dashboard</h3>
          <pre className="mt-4 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">
            {JSON.stringify(emergencies, null, 2)}
          </pre>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Critical alerts</h3>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl bg-red-50 p-4 text-red-800">
                <p className="font-bold">{alert.severity}</p>
                <p className="text-sm">{alert.message}</p>
                <button
                  className="mt-3 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white"
                  onClick={() => acknowledge.mutate(alert.id)}
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NursingScreen() {
  const queryClient = useQueryClient()
  const [admissionId, setAdmissionId] = useState('')
  const { data: admissions = [] } = useQuery({
    queryKey: ['nursing-admissions'],
    queryFn: () =>
      apiRequest<
        {
          id: string
          admissionNo: string
          patient?: PatientSummary
          bed?: { bedNo: string }
          ward?: { name: string }
        }[]
      >('/inpatient/admissions?status=active'),
  })
  const { data: vitals = [] } = useQuery({
    queryKey: ['vitals', admissionId],
    queryFn: () => apiRequest<unknown[]>(`/nursing/vitals?admissionId=${admissionId}`),
    enabled: Boolean(admissionId),
  })
  const { data: mar = [] } = useQuery({
    queryKey: ['mar', admissionId],
    queryFn: () => apiRequest<{ id: string; medicationName: string; status: string }[]>(`/nursing/mar/${admissionId}`),
    enabled: Boolean(admissionId),
  })
  const { data: observations = [] } = useQuery({
    queryKey: ['observations', admissionId],
    queryFn: () => apiRequest<unknown[]>(`/nursing/observations/${admissionId}`),
    enabled: Boolean(admissionId),
  })
  const { data: wards = [] } = useQuery({
    queryKey: ['nursing-wards'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/inpatient/wards'),
  })
  const createVitals = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/nursing/vitals', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
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
      await queryClient.invalidateQueries({ queryKey: ['vitals'] })
    },
  })
  const createMar = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/nursing/mar', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
          medicationName: form.get('medicationName'),
          genericName: form.get('genericName') || undefined,
          dosage: form.get('dosage'),
          route: form.get('route'),
          frequency: form.get('frequency'),
          scheduledTime: form.get('scheduledTime'),
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['mar', admissionId] }),
  })
  const updateMar = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/nursing/mar/${form.get('marId')}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: form.get('status'),
          withholdReason: form.get('withholdReason') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['mar', admissionId] }),
  })
  const createShiftNote = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/nursing/shift-notes', {
        method: 'POST',
        body: JSON.stringify({
          wardId: form.get('wardId'),
          shift: form.get('shift'),
          date: form.get('date'),
          type: form.get('type'),
          body: form.get('body'),
        }),
      })
    },
  })
  const createObservation = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/nursing/observations', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
          type: form.get('type'),
          value: form.get('value'),
          unit: form.get('unit') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['observations', admissionId] }),
  })

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Select active admission</h3>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Active admission</span>
          <select
            className="input mt-2"
            value={admissionId}
            onChange={(event) => setAdmissionId(event.target.value)}
            required
          >
            <option value="">Select admission</option>
            {admissions.map((admission) => (
              <option key={admission.id} value={admission.id}>
                {admission.admissionNo} · {admission.patient?.firstName}{' '}
                {admission.patient?.lastName} · {admission.ward?.name}{' '}
                {admission.bed?.bedNo}
              </option>
            ))}
          </select>
        </label>
      </div>
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          createVitals.mutate(event)
        }}
      >
        <h3 className="text-xl font-bold">Record vitals</h3>
        <Field name="temperature" label="Temperature" />
        <Field name="pulse" label="Pulse" />
        <Field name="respiratoryRate" label="Respiratory rate" />
        <Field name="bpSystolic" label="BP systolic" />
        <Field name="bpDiastolic" label="BP diastolic" />
        <Field name="spo2" label="SpO2" />
        {createVitals.error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {createVitals.error.message}
          </p>
        ) : null}
        {createVitals.isSuccess ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Vitals saved.
          </p>
        ) : null}
        <button
          className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!admissionId || createVitals.isPending}
        >
          {createVitals.isPending ? 'Saving...' : 'Save vitals'}
        </button>
      </form>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Recent vitals</h3>
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">
          {JSON.stringify(vitals, null, 2)}
        </pre>
      </div>
    </div>
    <div className="grid gap-6 xl:grid-cols-3">
      <QuickAddForm
        title="Schedule medication (MAR)"
        pending={createMar.isPending}
        onSubmit={(event) => {
          event.preventDefault()
          createMar.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <input name="medicationName" className="input" placeholder="Medication" required />
        <input name="genericName" className="input" placeholder="Generic name" />
        <input name="dosage" className="input" placeholder="Dosage" required />
        <select name="route" className="input" required>
          <option value="oral">Oral</option>
          <option value="iv">IV</option>
          <option value="im">IM</option>
          <option value="sc">SC</option>
          <option value="sl">SL</option>
          <option value="topical">Topical</option>
          <option value="inhaled">Inhaled</option>
          <option value="rectal">Rectal</option>
          <option value="nasal">Nasal</option>
        </select>
        <input name="frequency" className="input" placeholder="Frequency" required />
        <input name="scheduledTime" className="input" type="datetime-local" required />
      </QuickAddForm>
      <QuickAddForm
        title="Update MAR status"
        pending={updateMar.isPending}
        onSubmit={(event) => {
          event.preventDefault()
          updateMar.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <select name="marId" className="input" required>
          <option value="">Select MAR item</option>
          {mar.map((item) => (
            <option key={item.id} value={item.id}>
              {item.medicationName} · {item.status}
            </option>
          ))}
        </select>
        <select name="status" className="input" required>
          <option value="given">Given</option>
          <option value="withheld">Withheld</option>
          <option value="refused">Refused</option>
          <option value="not_available">Not available</option>
        </select>
        <input name="withholdReason" className="input" placeholder="Reason if not given" />
      </QuickAddForm>
      <QuickAddForm
        title="Nursing observation"
        pending={createObservation.isPending}
        onSubmit={(event) => {
          event.preventDefault()
          createObservation.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <select name="type" className="input" required>
          <option value="fluid_intake">Fluid intake</option>
          <option value="fluid_output">Fluid output</option>
          <option value="wound">Wound</option>
          <option value="bowel">Bowel</option>
          <option value="urine_output">Urine output</option>
          <option value="pain">Pain</option>
          <option value="neuro">Neuro</option>
          <option value="skin">Skin</option>
        </select>
        <input name="value" className="input" placeholder="Value" required />
        <input name="unit" className="input" placeholder="Unit" />
      </QuickAddForm>
      <QuickAddForm
        title="Shift note"
        pending={createShiftNote.isPending}
        onSubmit={(event) => {
          event.preventDefault()
          createShiftNote.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <select name="wardId" className="input" required>
          <option value="">Select ward</option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.name}
            </option>
          ))}
        </select>
        <input name="date" className="input" type="date" required />
        <select name="shift" className="input" required>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="night">Night</option>
        </select>
        <select name="type" className="input" required>
          <option value="handover">Handover</option>
          <option value="incident">Incident</option>
          <option value="general">General</option>
        </select>
        <textarea name="body" className="input" placeholder="Shift note" required />
      </QuickAddForm>
      <JsonPanel title="MAR" data={mar} />
      <JsonPanel title="Observations" data={observations} />
    </div>
    </div>
  )
}

function LaboratoryScreen() {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null)
  const { data: panels = [] } = useQuery({
    queryKey: ['lab-panels'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/laboratory/panels'),
  })
  const { data: tests = [] } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => apiRequest<{ id: string; name: string; code: string }[]>('/laboratory/tests'),
  })
  const { data: requests = [] } = useQuery({
    queryKey: ['lab-requests'],
    queryFn: () => apiRequest<unknown[]>('/laboratory/requests'),
  })
  const createRequest = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      const testId = form.get('testId')?.toString()
      const panelId = form.get('panelId')?.toString()
      return apiRequest('/laboratory/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          encounterId: form.get('encounterId'),
          admissionId: form.get('admissionId') || undefined,
          priority: form.get('priority'),
          notes: form.get('notes') || undefined,
          testIds: testId ? [testId] : [],
          panelIds: panelId ? [panelId] : [],
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
  })
  const collectSample = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/laboratory/requests/${form.get('requestId')}/samples`, {
        method: 'POST',
        body: JSON.stringify({ type: form.get('type') }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
  })
  const enterResult = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/laboratory/results', {
        method: 'POST',
        body: JSON.stringify({
          requestItemId: form.get('requestItemId'),
          sampleId: form.get('sampleId') || undefined,
          value: form.get('value'),
          unit: form.get('unit') || undefined,
        }),
      })
    },
  })
  const verifyRequest = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/laboratory/requests/${form.get('requestId')}/verify`, {
        method: 'POST',
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <QuickAddForm
          title="Create lab request"
          pending={createRequest.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createRequest.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <PatientLookup
            selectedPatient={selectedPatient}
            onSelect={setSelectedPatient}
          />
          <input name="encounterId" className="input" placeholder="Encounter ID" required />
          <input name="admissionId" className="input" placeholder="Admission ID" />
          <select name="priority" className="input" required>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
          <select name="testId" className="input">
            <option value="">Select test</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.name}
              </option>
            ))}
          </select>
          <select name="panelId" className="input">
            <option value="">Select panel</option>
            {panels.map((panel) => (
              <option key={panel.id} value={panel.id}>
                {panel.name}
              </option>
            ))}
          </select>
          <input name="notes" className="input" placeholder="Clinical notes" />
          {createRequest.error ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {createRequest.error.message}
            </p>
          ) : null}
          {createRequest.isSuccess ? (
            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              Lab request created.
            </p>
          ) : null}
        </QuickAddForm>
        <QuickAddForm
          title="Collect sample"
          pending={collectSample.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            collectSample.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="requestId" className="input" placeholder="Lab request ID" required />
          <input name="type" className="input" placeholder="Sample type" required />
        </QuickAddForm>
        <QuickAddForm
          title="Enter result"
          pending={enterResult.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            enterResult.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="requestItemId" className="input" placeholder="Request item ID" required />
          <input name="sampleId" className="input" placeholder="Sample ID" />
          <input name="value" className="input" placeholder="Result value" required />
          <input name="unit" className="input" placeholder="Unit" />
        </QuickAddForm>
        <QuickAddForm
          title="Verify request"
          pending={verifyRequest.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            verifyRequest.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="requestId" className="input" placeholder="Lab request ID" required />
        </QuickAddForm>
      </div>
      <JsonPanel title="Lab requests" data={requests} />
    </div>
  )
}

function RadiologyScreen() {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null)
  const [signedUpload, setSignedUpload] = useState<{ key: string; url: string } | null>(null)
  const { data: modalities = [] } = useQuery({
    queryKey: ['radiology-modalities'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/radiology/modalities'),
  })
  const { data: requests = [] } = useQuery({
    queryKey: ['radiology-requests'],
    queryFn: () => apiRequest<unknown[]>('/radiology/requests'),
  })
  const createRequest = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/radiology/requests', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          encounterId: form.get('encounterId'),
          admissionId: form.get('admissionId') || undefined,
          modalityId: form.get('modalityId'),
          bodyPart: form.get('bodyPart'),
          views: form.get('views') || undefined,
          clinicalIndication: form.get('clinicalIndication'),
          priority: form.get('priority'),
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['radiology-requests'] }),
  })
  const createReport = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/radiology/requests/${form.get('requestId')}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          findings: form.get('findings'),
          impression: form.get('impression'),
          recommendation: form.get('recommendation') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['radiology-requests'] }),
  })
  const presignUpload = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest<{ key: string; url: string }>('/storage/presign-upload', {
        method: 'POST',
        body: JSON.stringify({
          key: form.get('key'),
          contentType: form.get('contentType'),
          folder: 'radiology',
        }),
      })
    },
    onSuccess: (data) => setSignedUpload(data),
  })
  const addAttachment = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/radiology/requests/${form.get('requestId')}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: form.get('filename'),
          mimeType: form.get('mimeType'),
          storagePath: form.get('storagePath'),
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['radiology-requests'] }),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <QuickAddForm
          title="Create radiology request"
          pending={createRequest.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createRequest.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <PatientLookup
            selectedPatient={selectedPatient}
            onSelect={setSelectedPatient}
          />
          <input name="encounterId" className="input" placeholder="Encounter ID" required />
          <input name="admissionId" className="input" placeholder="Admission ID" />
          <select name="modalityId" className="input" required>
            {modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
          <input name="bodyPart" className="input" placeholder="Body part" required />
          <input name="views" className="input" placeholder="Views" />
          <input name="clinicalIndication" className="input" placeholder="Clinical indication" required />
          <select name="priority" className="input" required>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
          {createRequest.error ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {createRequest.error.message}
            </p>
          ) : null}
          {createRequest.isSuccess ? (
            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              Radiology request created.
            </p>
          ) : null}
        </QuickAddForm>
        <QuickAddForm
          title="Write report"
          pending={createReport.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createReport.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="requestId" className="input" placeholder="Radiology request ID" required />
          <textarea name="findings" className="input" placeholder="Findings" required />
          <textarea name="impression" className="input" placeholder="Impression" required />
          <textarea name="recommendation" className="input" placeholder="Recommendation" />
        </QuickAddForm>
        <QuickAddForm
          title="Get signed image upload URL"
          pending={presignUpload.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            presignUpload.mutate(event)
          }}
        >
          <input name="key" className="input" placeholder="file-name-or-path.png" required />
          <input name="contentType" className="input" placeholder="image/png" required />
          {signedUpload ? (
            <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
              <p className="font-bold">Upload key: {signedUpload.key}</p>
              <p className="mt-2 break-all">{signedUpload.url}</p>
            </div>
          ) : null}
        </QuickAddForm>
        <QuickAddForm
          title="Attach uploaded image reference"
          pending={addAttachment.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            addAttachment.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="requestId" className="input" placeholder="Radiology request ID" required />
          <input name="filename" className="input" placeholder="Filename" required />
          <input name="mimeType" className="input" placeholder="image/png" required />
          <input
            name="storagePath"
            className="input"
            placeholder="Use signed upload key"
            defaultValue={signedUpload?.key ?? ''}
            required
          />
        </QuickAddForm>
      </div>
      <JsonPanel title="Radiology requests" data={requests} />
    </div>
  )
}

function ResultsInbox() {
  const queryClient = useQueryClient()
  const { data: labResults = [] } = useQuery({
    queryKey: ['lab-results-inbox'],
    queryFn: () => apiRequest<{ id: string; value?: string; flag?: string; reviewedAt?: string | null }[]>('/laboratory/results/inbox'),
  })
  const { data: criticalResults = [] } = useQuery({
    queryKey: ['critical-results'],
    queryFn: () => apiRequest<{ id: string; value?: string; flag?: string; reviewedAt?: string | null }[]>('/laboratory/results/critical'),
  })
  const { data: radiologyReports = [] } = useQuery({
    queryKey: ['radiology-reports-inbox'],
    queryFn: () => apiRequest<{ id: string; impression?: string; reviewedAt?: string | null }[]>('/radiology/reports/inbox'),
  })
  const reviewLab = useMutation({
    mutationFn: (id: string) => apiRequest(`/laboratory/results/${id}/review`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lab-results-inbox'] })
      await queryClient.invalidateQueries({ queryKey: ['critical-results'] })
    },
  })
  const reviewRadiology = useMutation({
    mutationFn: (id: string) => apiRequest(`/radiology/reports/${id}/review`, { method: 'POST' }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['radiology-reports-inbox'] }),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <ReviewList title="Verified lab results" items={labResults} onReview={reviewLab.mutate} />
      <ReviewList title="Critical lab results" items={criticalResults} onReview={reviewLab.mutate} />
      <ReviewList title="Radiology reports" items={radiologyReports} onReview={reviewRadiology.mutate} />
    </div>
  )
}

function ReviewList({
  title,
  items,
  onReview,
}: {
  title: string
  items: { id: string; value?: string; flag?: string; impression?: string; reviewedAt?: string | null }[]
  onReview: (id: string) => void
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">{item.id}</p>
            <p className="mt-1 font-semibold">
              {item.impression ?? `${item.value ?? ''} ${item.flag ?? ''}`}
            </p>
            <button
              className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300"
              disabled={Boolean(item.reviewedAt)}
              onClick={() => onReview(item.id)}
            >
              {item.reviewedAt ? 'Reviewed' : 'Mark reviewed'}
            </button>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-slate-500">No items.</p> : null}
      </div>
    </div>
  )
}

function TheatreScreen() {
  const queryClient = useQueryClient()
  const { data: theatres = [] } = useQuery({
    queryKey: ['theatres'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/theatre/theatres'),
  })
  const { data: procedures = [] } = useQuery({
    queryKey: ['surgical-procedures'],
    queryFn: () =>
      apiRequest<{ id: string; name: string }[]>('/theatre/procedures'),
  })
  const { data: bookings = [] } = useQuery({
    queryKey: ['surgery-bookings'],
    queryFn: () => apiRequest<unknown[]>('/theatre/bookings'),
  })
  const createTheatre = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/theatre/theatres', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          location: form.get('location'),
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['theatres'] }),
  })
  const createProcedure = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/theatre/procedures', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          category: form.get('category'),
          expectedDurationMinutes: Number(form.get('expectedDurationMinutes') || 0),
        }),
      })
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['surgical-procedures'] }),
  })
  const createBooking = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/theatre/bookings', {
        method: 'POST',
        body: JSON.stringify({
          patientId: form.get('patientId'),
          admissionId: form.get('admissionId') || undefined,
          procedureId: form.get('procedureId'),
          theatreId: form.get('theatreId') || undefined,
          scheduledStartAt: form.get('scheduledStartAt'),
          priority: form.get('priority'),
        }),
      })
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['surgery-bookings'] }),
  })
  const updateBookingStatus = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/theatre/bookings/${form.get('bookingId')}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.get('status') }),
      })
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['surgery-bookings'] }),
  })
  const assignStaff = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/theatre/bookings/${form.get('bookingId')}/staff`, {
        method: 'POST',
        body: JSON.stringify({ userId: form.get('userId'), role: form.get('role') }),
      })
    },
  })
  const addSurgeryNote = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/theatre/bookings/${form.get('bookingId')}/notes`, {
        method: 'POST',
        body: JSON.stringify({ type: form.get('type'), body: form.get('body') }),
      })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <QuickAddForm
          title="Create theatre"
          pending={createTheatre.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createTheatre.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="name" className="input" placeholder="Theatre name" required />
          <input name="code" className="input" placeholder="Code" required />
          <input name="location" className="input" placeholder="Location" />
        </QuickAddForm>
        <QuickAddForm
          title="Create surgical procedure"
          pending={createProcedure.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createProcedure.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="name" className="input" placeholder="Procedure name" required />
          <input name="code" className="input" placeholder="Code" required />
          <input name="category" className="input" placeholder="Category" />
          <input
            name="expectedDurationMinutes"
            className="input"
            placeholder="Expected minutes"
          />
        </QuickAddForm>
        <QuickAddForm
          title="Book surgery"
          pending={createBooking.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createBooking.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="patientId" className="input" placeholder="Patient ID" required />
          <input name="admissionId" className="input" placeholder="Admission ID" />
          <select name="procedureId" className="input" required>
            {procedures.map((procedure) => (
              <option key={procedure.id} value={procedure.id}>
                {procedure.name}
              </option>
            ))}
          </select>
          <select name="theatreId" className="input">
            <option value="">No theatre assigned</option>
            {theatres.map((theatre) => (
              <option key={theatre.id} value={theatre.id}>
                {theatre.name}
              </option>
            ))}
          </select>
          <input name="scheduledStartAt" type="datetime-local" className="input" required />
          <select name="priority" className="input" required>
            <option value="elective">Elective</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </QuickAddForm>
        <QuickAddForm
          title="Update surgery status"
          pending={updateBookingStatus.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            updateBookingStatus.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="bookingId" className="input" placeholder="Surgery booking ID" required />
          <select name="status" className="input" required>
            <option value="requested">Requested</option>
            <option value="scheduled">Scheduled</option>
            <option value="pre_op">Pre-op</option>
            <option value="in_theatre">In theatre</option>
            <option value="recovery">Recovery</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </QuickAddForm>
        <QuickAddForm
          title="Assign theatre staff"
          pending={assignStaff.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            assignStaff.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="bookingId" className="input" placeholder="Surgery booking ID" required />
          <input name="userId" className="input" placeholder="Staff user ID" required />
          <select name="role" className="input" required>
            <option value="primary_surgeon">Primary surgeon</option>
            <option value="assistant_surgeon">Assistant surgeon</option>
            <option value="anesthetist">Anesthetist</option>
            <option value="theatre_nurse">Theatre nurse</option>
            <option value="scrub_nurse">Scrub nurse</option>
            <option value="circulating_nurse">Circulating nurse</option>
          </select>
        </QuickAddForm>
        <QuickAddForm
          title="Add surgery note"
          pending={addSurgeryNote.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            addSurgeryNote.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="bookingId" className="input" placeholder="Surgery booking ID" required />
          <select name="type" className="input" required>
            <option value="pre_op_assessment">Pre-op assessment</option>
            <option value="consent">Consent</option>
            <option value="checklist">Checklist</option>
            <option value="intraoperative">Intraoperative</option>
            <option value="operation">Operation note</option>
            <option value="findings">Findings</option>
            <option value="post_op">Post-op</option>
            <option value="recovery">Recovery</option>
          </select>
          <textarea name="body" className="input" placeholder="Note" required />
        </QuickAddForm>
      </div>
      <JsonPanel title="Surgery bookings" data={bookings} />
    </div>
  )
}

function MaternityScreen() {
  const queryClient = useQueryClient()
  const [selectedPregnancyId, setSelectedPregnancyId] = useState('')
  const { data: pregnancies = [] } = useQuery({
    queryKey: ['pregnancies'],
    queryFn: () =>
      apiRequest<{ id: string; pregnancyNo: string; patient?: PatientSummary }[]>(
        '/maternity/pregnancies',
      ),
  })
  const createPregnancy = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/maternity/pregnancies', {
        method: 'POST',
        body: JSON.stringify({
          patientId: form.get('patientId'),
          admissionId: form.get('admissionId') || undefined,
          gravida: Number(form.get('gravida') || 0),
          para: Number(form.get('para') || 0),
          lmpDate: form.get('lmpDate') || undefined,
          riskLevel: form.get('riskLevel'),
          riskNotes: form.get('riskNotes') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['pregnancies'] }),
  })
  const createAnc = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/maternity/pregnancies/${selectedPregnancyId}/anc-visits`, {
        method: 'POST',
        body: JSON.stringify({
          visitDate: form.get('visitDate'),
          gestationalAgeWeeks: Number(form.get('gestationalAgeWeeks') || 0),
          riskAssessment: form.get('riskAssessment') || undefined,
          plan: form.get('plan'),
        }),
      })
    },
  })
  const createDelivery = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/maternity/pregnancies/${selectedPregnancyId}/deliveries`, {
        method: 'POST',
        body: JSON.stringify({
          deliveryTime: form.get('deliveryTime'),
          mode: form.get('mode'),
          outcome: form.get('outcome'),
          bloodLossMl: Number(form.get('bloodLossMl') || 0),
          complications: form.get('complications') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['pregnancies'] }),
  })
  const createLabour = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/maternity/pregnancies/${selectedPregnancyId}/labour-records`, {
        method: 'POST',
        body: JSON.stringify({
          admissionId: form.get('admissionId') || undefined,
          cervicalDilationCm: Number(form.get('cervicalDilationCm') || 0),
          contractions: form.get('contractions') || undefined,
          fetalHeartRate: Number(form.get('fetalHeartRate') || 0),
          membranesStatus: form.get('membranesStatus') || undefined,
          notes: form.get('notes') || undefined,
        }),
      })
    },
  })
  const createNewborn = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/maternity/deliveries/${form.get('deliveryId')}/newborns`, {
        method: 'POST',
        body: JSON.stringify({
          babyPatientId: form.get('babyPatientId') || undefined,
          sex: form.get('sex'),
          birthWeightGrams: Number(form.get('birthWeightGrams') || 0),
          apgar1Min: Number(form.get('apgar1Min') || 0),
          apgar5Min: Number(form.get('apgar5Min') || 0),
          apgar10Min: Number(form.get('apgar10Min') || 0),
          resuscitationRequired: form.get('resuscitationRequired') === 'on',
          status: form.get('status'),
        }),
      })
    },
  })
  const createPostnatal = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/maternity/pregnancies/${selectedPregnancyId}/postnatal-visits`, {
        method: 'POST',
        body: JSON.stringify({
          visitDate: form.get('visitDate'),
          motherCondition: form.get('motherCondition'),
          newbornCondition: form.get('newbornCondition') || undefined,
          feedingStatus: form.get('feedingStatus') || undefined,
          dangerSigns: form.get('dangerSigns') || undefined,
          plan: form.get('plan'),
        }),
      })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <QuickAddForm
          title="Register pregnancy"
          pending={createPregnancy.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createPregnancy.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="patientId" className="input" placeholder="Mother patient ID" required />
          <input name="admissionId" className="input" placeholder="Admission ID" />
          <input name="gravida" className="input" placeholder="Gravida" required />
          <input name="para" className="input" placeholder="Para" required />
          <input name="lmpDate" className="input" type="date" />
          <select name="riskLevel" className="input">
            <option value="low">Low risk</option>
            <option value="moderate">Moderate risk</option>
            <option value="high">High risk</option>
          </select>
          <input name="riskNotes" className="input" placeholder="Risk notes" />
        </QuickAddForm>
        <select
          className="input"
          value={selectedPregnancyId}
          onChange={(event) => setSelectedPregnancyId(event.target.value)}
        >
          <option value="">Select pregnancy for ANC/delivery</option>
          {pregnancies.map((pregnancy) => (
            <option key={pregnancy.id} value={pregnancy.id}>
              {pregnancy.pregnancyNo}
            </option>
          ))}
        </select>
        <QuickAddForm
          title="Add ANC visit"
          pending={createAnc.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createAnc.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="visitDate" className="input" type="date" required />
          <input name="gestationalAgeWeeks" className="input" placeholder="Gestational weeks" />
          <input name="riskAssessment" className="input" placeholder="Risk assessment" />
          <input name="plan" className="input" placeholder="Plan" required />
        </QuickAddForm>
        <QuickAddForm
          title="Labour record"
          pending={createLabour.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createLabour.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="admissionId" className="input" placeholder="Admission ID" />
          <input name="cervicalDilationCm" className="input" placeholder="Cervical dilation cm" />
          <input name="contractions" className="input" placeholder="Contractions" />
          <input name="fetalHeartRate" className="input" placeholder="Fetal heart rate" />
          <input name="membranesStatus" className="input" placeholder="Membranes status" />
          <textarea name="notes" className="input" placeholder="Notes" />
        </QuickAddForm>
        <QuickAddForm
          title="Record delivery"
          pending={createDelivery.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createDelivery.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="deliveryTime" className="input" type="datetime-local" required />
          <select name="mode" className="input" required>
            <option value="svd">SVD</option>
            <option value="assisted">Assisted</option>
            <option value="cesarean">Cesarean</option>
            <option value="breech">Breech</option>
          </select>
          <select name="outcome" className="input" required>
            <option value="live_birth">Live birth</option>
            <option value="stillbirth">Stillbirth</option>
            <option value="maternal_transfer">Maternal transfer</option>
            <option value="maternal_death">Maternal death</option>
          </select>
          <input name="bloodLossMl" className="input" placeholder="Blood loss ml" />
          <input name="complications" className="input" placeholder="Complications" />
        </QuickAddForm>
        <QuickAddForm
          title="Register newborn"
          pending={createNewborn.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createNewborn.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="deliveryId" className="input" placeholder="Delivery ID" required />
          <input name="babyPatientId" className="input" placeholder="Baby patient ID if registered" />
          <select name="sex" className="input" required>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="unknown">Unknown</option>
          </select>
          <input name="birthWeightGrams" className="input" placeholder="Birth weight grams" />
          <input name="apgar1Min" className="input" placeholder="APGAR 1 min" />
          <input name="apgar5Min" className="input" placeholder="APGAR 5 min" />
          <input name="apgar10Min" className="input" placeholder="APGAR 10 min" />
          <label className="flex items-center gap-2 text-sm">
            <input name="resuscitationRequired" type="checkbox" /> Resuscitation required
          </label>
          <select name="status" className="input" required>
            <option value="alive">Alive</option>
            <option value="stillborn">Stillborn</option>
            <option value="referred">Referred</option>
            <option value="deceased">Deceased</option>
          </select>
        </QuickAddForm>
        <QuickAddForm
          title="Postnatal visit"
          pending={createPostnatal.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            createPostnatal.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="visitDate" className="input" type="date" required />
          <textarea name="motherCondition" className="input" placeholder="Mother condition" required />
          <textarea name="newbornCondition" className="input" placeholder="Newborn condition" />
          <input name="feedingStatus" className="input" placeholder="Feeding status" />
          <textarea name="dangerSigns" className="input" placeholder="Danger signs" />
          <textarea name="plan" className="input" placeholder="Plan" required />
        </QuickAddForm>
      </div>
      <JsonPanel title="Pregnancies" data={pregnancies} />
    </div>
  )
}

function IcuScreen() {
  return <CriticalCareScreen unit="icu" title="ICU" />
}

function HduScreen() {
  return <CriticalCareScreen unit="hdu" title="HDU" />
}

function CriticalCareScreen({ unit, title }: { unit: 'icu' | 'hdu'; title: string }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const { data: admissions = [] } = useQuery({
    queryKey: [`${unit}-admissions`],
    queryFn: () =>
      apiRequest<{ id: string; admission?: { admissionNo: string; patient?: PatientSummary } }[]>(
        `/${unit}/admissions`,
      ),
  })
  const admit = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/${unit}/admissions`, {
        method: 'POST',
        body: JSON.stringify({
          admissionId: form.get('admissionId'),
          [`${unit}BedId`]: form.get('bedId') || undefined,
          reason: form.get('reason'),
          severityScore: unit === 'icu' ? Number(form.get('severityScore') || 0) : undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: [`${unit}-admissions`] }),
  })
  const observe = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/${unit}/admissions/${selectedId}/observations`, {
        method: 'POST',
        body: JSON.stringify({
          heartRate: Number(form.get('heartRate') || 0),
          respiratoryRate: Number(form.get('respiratoryRate') || 0),
          bpSystolic: Number(form.get('bpSystolic') || 0),
          bpDiastolic: Number(form.get('bpDiastolic') || 0),
          spo2: Number(form.get('spo2') || 0),
          gcs: unit === 'icu' ? Number(form.get('gcs') || 0) : undefined,
          oxygenSupport: unit === 'hdu' ? form.get('oxygenSupport') || undefined : undefined,
          escalationRequired: unit === 'hdu' ? form.get('escalationRequired') === 'on' : undefined,
          notes: form.get('notes') || undefined,
        }),
      })
    },
  })
  const round = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/${unit}/admissions/${selectedId}/rounds`, {
        method: 'POST',
        body: JSON.stringify({
          assessment: form.get('assessment'),
          plan: form.get('plan'),
          escalationDecision: form.get('escalationDecision') || undefined,
        }),
      })
    },
  })
  const updateStatus = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/${unit}/admissions/${selectedId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.get('status') }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: [`${unit}-admissions`] }),
  })
  const ventilator = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/icu/admissions/${selectedId}/ventilator-records`, {
        method: 'POST',
        body: JSON.stringify({
          mode: form.get('mode'),
          fio2: Number(form.get('fio2') || 0),
          peep: Number(form.get('peep') || 0),
          tidalVolume: Number(form.get('tidalVolume') || 0),
          notes: form.get('notes') || undefined,
        }),
      })
    },
  })
  const fluid = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/icu/admissions/${selectedId}/fluid-balance`, {
        method: 'POST',
        body: JSON.stringify({
          inputVolumeMl: Number(form.get('inputVolumeMl') || 0),
          outputVolumeMl: Number(form.get('outputVolumeMl') || 0),
          notes: form.get('notes') || undefined,
        }),
      })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <QuickAddForm
          title={`${title} admission`}
          pending={admit.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            admit.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="admissionId" className="input" placeholder="Base admission ID" required />
          <input name="bedId" className="input" placeholder={`${title} bed ID`} />
          <input name="reason" className="input" placeholder="Reason" required />
          {unit === 'icu' ? (
            <input name="severityScore" className="input" placeholder="Severity score" />
          ) : null}
        </QuickAddForm>
        <select className="input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Select {title} admission</option>
          {admissions.map((admission) => (
            <option key={admission.id} value={admission.id}>
              {admission.admission?.admissionNo ?? admission.id}
            </option>
          ))}
        </select>
        <QuickAddForm
          title={`${title} observation`}
          pending={observe.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            observe.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <input name="heartRate" className="input" placeholder="Heart rate" />
          <input name="respiratoryRate" className="input" placeholder="Resp rate" />
          <input name="bpSystolic" className="input" placeholder="BP sys" />
          <input name="bpDiastolic" className="input" placeholder="BP dia" />
          <input name="spo2" className="input" placeholder="SpO2" />
          {unit === 'icu' ? <input name="gcs" className="input" placeholder="GCS" /> : null}
          {unit === 'hdu' ? <input name="oxygenSupport" className="input" placeholder="Oxygen support" /> : null}
          {unit === 'hdu' ? (
            <label className="flex items-center gap-2 text-sm">
              <input name="escalationRequired" type="checkbox" /> Escalation required
            </label>
          ) : null}
          <input name="notes" className="input" placeholder="Notes" />
        </QuickAddForm>
        <QuickAddForm
          title={`${title} round`}
          pending={round.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            round.mutate(event)
            event.currentTarget.reset()
          }}
        >
          <textarea name="assessment" className="input" placeholder="Assessment" required />
          <textarea name="plan" className="input" placeholder="Plan" required />
          <input name="escalationDecision" className="input" placeholder="Escalation decision" />
        </QuickAddForm>
        <QuickAddForm
          title={`${title} status`}
          pending={updateStatus.isPending}
          onSubmit={(event) => {
            event.preventDefault()
            updateStatus.mutate(event)
          }}
        >
          <select name="status" className="input" required>
            <option value="transferred_out">Transferred out</option>
            <option value="discharged">Discharged</option>
            <option value="died">Died</option>
          </select>
        </QuickAddForm>
        {unit === 'icu' ? (
          <>
            <QuickAddForm
              title="Ventilator record"
              pending={ventilator.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                ventilator.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <input name="mode" className="input" placeholder="Mode" required />
              <input name="fio2" className="input" placeholder="FiO2" />
              <input name="peep" className="input" placeholder="PEEP" />
              <input name="tidalVolume" className="input" placeholder="Tidal volume" />
              <textarea name="notes" className="input" placeholder="Notes" />
            </QuickAddForm>
            <QuickAddForm
              title="Fluid balance"
              pending={fluid.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                fluid.mutate(event)
                event.currentTarget.reset()
              }}
            >
              <input name="inputVolumeMl" className="input" placeholder="Input ml" />
              <input name="outputVolumeMl" className="input" placeholder="Output ml" />
              <textarea name="notes" className="input" placeholder="Notes" />
            </QuickAddForm>
          </>
        ) : null}
      </div>
      <JsonPanel title={`${title} admissions`} data={admissions} />
    </div>
  )
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">{title}</h3>
      <pre className="mt-4 max-h-[42rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-50">
        {JSON.stringify(data, null, 2)}
      </pre>
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
  departments?: { id: string; name: string; isPrimary?: boolean }[]
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
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => apiRequest<{ id: string; name: string; code: string }[]>('/admin/departments'),
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
  const createDepartment = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest('/admin/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          type: form.get('type') || undefined,
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin-departments'] }),
  })
  const assignDepartment = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      const form = new FormData(event.currentTarget)
      return apiRequest(`/admin/users/${form.get('userId')}/departments`, {
        method: 'POST',
        body: JSON.stringify({
          departmentId: form.get('departmentId'),
          isPrimary: form.get('isPrimary') === 'on',
        }),
      })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
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
      <QuickAddForm
        title="Create department"
        pending={createDepartment.isPending}
        onSubmit={(event) => {
          event.preventDefault()
          createDepartment.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <input name="name" className="input" placeholder="Department name" required />
        <input name="code" className="input" placeholder="Code" required />
        <input name="type" className="input" placeholder="clinical / diagnostic / admin" />
      </QuickAddForm>
      <QuickAddForm
        title="Assign user to department"
        pending={assignDepartment.isPending}
        onSubmit={(event) => {
          event.preventDefault()
          assignDepartment.mutate(event)
          event.currentTarget.reset()
        }}
      >
        <select name="userId" className="input" required>
          <option value="">Select user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
        </select>
        <select name="departmentId" className="input" required>
          <option value="">Select department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input name="isPrimary" type="checkbox" /> Primary department
        </label>
      </QuickAddForm>
      </div>

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
              <p className="mt-1 text-sm text-slate-500">
                Departments:{' '}
                {user.departments?.map((department) => department.name).join(', ') || 'none'}
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
    <div className="grid gap-6 xl:grid-cols-[0.7fr_0.3fr]">
      <form
        key={data ? `${data.smsSenderName}-${data.patientIdPrefix}-${data.triageSystem}` : 'loading'}
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate(event)
        }}
      >
        <div>
          <p className="text-sm font-semibold uppercase text-blue-600">Administration</p>
          <h3 className="text-xl font-bold">Hospital settings</h3>
          <p className="mt-1 text-sm text-slate-500">
            These values control patient numbers, messaging identity, and triage defaults for the active tenant.
          </p>
        </div>
        <label>
          <span className="text-sm font-semibold">SMS sender name</span>
          <input
            name="smsSenderName"
            className="input mt-2"
            defaultValue={data?.smsSenderName ?? ''}
          />
        </label>
        <label>
          <span className="text-sm font-semibold">Patient ID prefix</span>
          <input
            name="patientIdPrefix"
            className="input mt-2"
            defaultValue={data?.patientIdPrefix ?? ''}
          />
        </label>
        <label>
          <span className="text-sm font-semibold">Triage system</span>
          <input
            name="triageSystem"
            className="input mt-2"
            defaultValue={data?.triageSystem ?? ''}
          />
        </label>
        {update.error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {update.error.message}
          </p>
        ) : null}
        {update.isSuccess ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            Settings saved.
          </p>
        ) : null}
        <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
          {update.isPending ? 'Saving...' : 'Save settings'}
        </button>
      </form>
      <div className="rounded-3xl bg-blue-950 p-6 text-white shadow-sm">
        <h3 className="text-lg font-bold">Tip</h3>
        <p className="mt-3 text-sm text-blue-100">
          If settings do not appear, confirm you are logged in as Administrator and using tenant <strong>demo</strong>.
        </p>
      </div>
    </div>
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
