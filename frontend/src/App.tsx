import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Bell,
  ClipboardList,
  KeyRound,
  LogOut,
  Printer,
} from 'lucide-react'
import {
  Card,
  Field,
  NavGroup,
  PageHeader,
  PasswordInput,
  TriageBadge,
  TriageIndicator,
  triageCardAccent,
} from './components/ui'
import { PatientSearchAutocomplete, PatientSearchBrowse } from './components/PatientSearchAutocomplete'
import { PatientContextHeader } from './components/PatientContextHeader'
import { PatientRegistrationForm } from './components/PatientRegistrationForm'
import { DoctorConsultationWorkspace } from './components/DoctorConsultationWorkspace'
import { PatientTimeline } from './components/PatientTimeline'
import type { WorkflowStep } from './lib/workflow-status'
import { IpdModule } from './components/ipd/IpdModule'
import { HospitalControlCenter } from './components/admin/HospitalControlCenter'
import { HospitalBrandMark, HospitalFacilityBadge } from './components/branding/HospitalBrandMark'
import { useClinicalCatalog } from './hooks/useClinicalCatalog'
import { resolveHospitalBranding } from './lib/hospital-configuration'
import { OpdCheckInWorkspace } from './components/opd/OpdCheckInWorkspace'
import { TriageWorkspace } from './components/opd/TriageWorkspace'
import { AppointmentCenter } from './components/appointments/AppointmentCenter'
import { ReferralWorkspace } from './components/referrals/ReferralWorkspace'
import { LabWorklist } from './components/investigations/LabWorklist'
import { LabDashboard } from './components/investigations/LabDashboard'
import { RadiologyWorklist } from './components/investigations/RadiologyWorklist'
import { ImagingDashboard } from './components/investigations/ImagingDashboard'
import { ClinicalOrdersDashboard, PharmacyWorkspace } from './components/orders/ClinicalOrdersDashboard'
import { MedicalDocumentsCenter } from './components/documents/MedicalDocumentsCenter'
import { HospitalLibrary } from './components/documents/HospitalLibrary'
import { SickSheetWorkspace } from './components/documents/SickSheetWorkspace'
import { MaternityServiceLine } from './components/maternity/MaternityServiceLine'
import { EmergencyCommandCenter } from './components/emergency/EmergencyCommandCenter'
import { NotificationInbox } from './components/notifications/NotificationInbox'
import { OperationsCommandCenter } from './components/operations/OperationsCommandCenter'
import { OperationalWorklists } from './components/worklists/OperationalWorklists'
import {
  EmergencyPatientsView,
  IpdPatientsView,
  LabPatientsView,
  OpdPatientsView,
  RadiologyPatientsView,
} from './components/patients/ModulePatientViews'
import { ClinicalReportsDashboard } from './components/reports/ClinicalReportsDashboard'
import { ExecutiveAnalyticsDashboard } from './components/reports/ExecutiveAnalyticsDashboard'
import { TheatreWorkspace } from './components/theatre/TheatreWorkspace'
import { PatientCardPrint } from './components/patients/PatientCardPrint'
import { useHospitalSync } from './hooks/useHospitalSync'
import { formDataFromElement } from './lib/form-utils'
import { apiRequest } from './lib/api'
import { useAuthStore } from './lib/auth-store'
import { useAuthSession } from './hooks/useAuthSession'
import { DEFAULT_TENANT, HIDE_TENANT_SELECTOR, SINGLE_TENANT_MODE } from './lib/tenant-config'

import { filterNavigationByModules } from './lib/nav-module-filter'
import { navigation, workflowDescriptions } from './lib/navigation'
import { AppMobileNav } from './components/layout/AppMobileNav'

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

interface AppNotification {
  id: string
  title: string
  body: string
  severity?: 'info' | 'success' | 'warning' | 'critical'
}

function emitAppNotification(notification: Omit<AppNotification, 'id'>) {
  window.dispatchEvent(
    new CustomEvent('afyasasa-notification', {
      detail: { ...notification, id: crypto.randomUUID() },
    }),
  )
}

function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function SessionLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-300">Restoring your session…</p>
      </div>
    </div>
  )
}

function App() {
  const { user, accessToken, tenant, setTenant, clearSession } = useAuthStore()
  const { hydrated } = useAuthSession()
  const [activeScreen, setActiveScreen] = useState(() => {
    const saved = sessionStorage.getItem('afyasasa.activeScreen')?.trim()
    return saved || 'Patient Search'
  })
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const greeting = `${greetingForNow()} ${user?.firstName ?? ''}`.trim()

  const goToScreen = (screen: string) => {
    const next = screen?.trim()
    if (!next) return
    setActiveScreen(next)
  }

  useEffect(() => {
    if (activeScreen.trim()) {
      sessionStorage.setItem('afyasasa.activeScreen', activeScreen)
    }
  }, [activeScreen])

  const { data: notificationSummary } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => apiRequest<{ unread: number }>('/notifications/inbox/summary'),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  })

  useHospitalSync()
  const { data: hospitalCatalog } = useClinicalCatalog()
  const hospitalBrand = resolveHospitalBranding(hospitalCatalog)

  useEffect(() => {
    if (!accessToken) return
    document.title = `${hospitalBrand.facilityName ?? 'AfyaSasa'} — Clinical EMR`
    if (hospitalBrand.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = hospitalBrand.faviconUrl
    }
  }, [accessToken, hospitalBrand.facilityName, hospitalBrand.faviconUrl])

  if (!hydrated) {
    return <SessionLoadingScreen />
  }

  if (!accessToken || !user) {
    return <LoginScreen tenant={tenant} setTenant={setTenant} />
  }

  if (user.forcePasswordChange) {
    return <ForcedPasswordChangeScreen />
  }

  const allowedNavigation = filterNavigationByModules(
    navigation.filter((item) => user.permissions.includes(item.permission)),
    hospitalCatalog,
  )
  const groupedNavigation = allowedNavigation.reduce(
    (groups, item) => {
      groups[item.group] = [...(groups[item.group] ?? []), item]
      return groups
    },
    {} as Record<string, typeof allowedNavigation>,
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <NotificationCenter />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200/80 bg-white shadow-sm xl:flex">
        <div className="shrink-0 border-b border-slate-100 p-5">
          <HospitalBrandMark />
          {!SINGLE_TENANT_MODE ? <HospitalFacilityBadge label={tenant} /> : null}
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {Object.entries(groupedNavigation).map(([group, items]) => (
            <NavGroup key={group} title={group} defaultOpen={group === 'Reception' || group === 'Outpatient'}>
              {items.map((item) => {
                const Icon = item.icon
                const active = activeScreen === item.label
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition duration-150 ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => goToScreen(item.label)}
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                )
              })}
            </NavGroup>
          ))}
        </nav>
      </aside>

      <main className="min-h-dvh w-full min-w-0 max-w-full overflow-x-hidden xl:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 md:px-5">
            <AppMobileNav
              items={allowedNavigation}
              activeScreen={activeScreen}
              onNavigate={goToScreen}
              tenant={tenant}
            />
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="welcome-line truncate text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
                {greeting}
                <span className="welcome-accent font-medium text-teal-700">
                  {' '}
                  — welcome to the system
                </span>
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-500 animate-fade-in">
                {workflowDescriptions[activeScreen] ?? 'Clinical workflow'}
              </p>
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {activeScreen}
              </h2>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
              {user.forcePasswordChange ? <ForcedPasswordNotice /> : null}
              <button
                type="button"
                className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => goToScreen('Notifications')}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {(notificationSummary?.unread ?? 0) > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notificationSummary!.unread > 9 ? '9+' : notificationSummary!.unread}
                  </span>
                ) : null}
              </button>
              <div className="hidden text-right text-sm sm:block">
                <p className="max-w-[8rem] truncate font-semibold sm:max-w-none">
                  {user.firstName} {user.lastName}
                </p>
                <p className="max-w-[8rem] truncate text-slate-500 sm:max-w-none">
                  {user.roles.join(', ')}
                </p>
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

        <section className="min-h-[calc(100dvh-4.5rem)] w-full min-w-0 max-w-full overflow-x-hidden p-3 sm:p-4 md:p-6">
          {activeScreen === 'Patient Search' ? (
            <PatientSearch onSelect={(patient) => setSelectedPatientId(patient.id)} />
          ) : null}
          {activeScreen === 'Register Patient' ? <PatientRegistrationForm /> : null}
          {activeScreen === 'Patient Timeline' ? (
            <PatientTimelineScreen
              onOpenProfile={(id) => {
                setSelectedPatientId(id)
              }}
            />
          ) : null}
          {activeScreen === 'OPD Check-In' ? <OpdCheckInWorkspace /> : null}
          {activeScreen === 'Triage Queue' ? <TriageWorkspace /> : null}
          {activeScreen === 'OPD Patients' ? (
            <OpdPatientsView onOpenPatient={setSelectedPatientId} />
          ) : null}
          {activeScreen === 'Doctor Queue' ? <DoctorQueue /> : null}
          {activeScreen === 'Lab Dashboard' ? <LabDashboard /> : null}
          {activeScreen === 'Laboratory' ? <LabWorklist /> : null}
          {activeScreen === 'Lab Patients' ? (
            <LabPatientsView onOpenPatient={setSelectedPatientId} />
          ) : null}
          {activeScreen === 'Imaging Dashboard' ? <ImagingDashboard /> : null}
          {activeScreen === 'Radiology' ? <RadiologyWorklist /> : null}
          {activeScreen === 'Imaging Patients' ? (
            <RadiologyPatientsView onOpenPatient={setSelectedPatientId} />
          ) : null}
          {activeScreen === 'Results Inbox' ? <ResultsInbox /> : null}
          {activeScreen === 'Appointments' ? <AppointmentCenter /> : null}
          {activeScreen === 'Referrals' ? <ReferralWorkspace /> : null}
          {activeScreen === 'Medical Documents' ? <MedicalDocumentsCenter /> : null}
          {activeScreen === 'Hospital Library' ? <HospitalLibrary /> : null}
          {activeScreen === 'Sick Sheets' ? <SickSheetWorkspace /> : null}
          {activeScreen === 'OPD Reports' ? <OpdReports /> : null}
          {activeScreen === 'Inpatient (IPD)' ? <IpdModule /> : null}
          {activeScreen === 'Nursing' ? <IpdModule initialScreen="nursing" /> : null}
          {activeScreen === 'IPD Patients' ? (
            <IpdPatientsView onOpenPatient={setSelectedPatientId} />
          ) : null}
          {activeScreen === 'Emergency' ? <EmergencyCommandCenter /> : null}
          {activeScreen === 'ED Patients' ? (
            <EmergencyPatientsView onOpenPatient={setSelectedPatientId} />
          ) : null}
          {activeScreen === 'Clinical Reports' ? <ClinicalReportsDashboard /> : null}
          {activeScreen === 'Executive Analytics' ? <ExecutiveAnalyticsDashboard /> : null}
          {activeScreen === 'Clinical Orders' ? <ClinicalOrdersDashboard /> : null}
          {activeScreen === 'Pharmacy' ? <PharmacyWorkspace /> : null}
          {activeScreen === 'Theatre' ? <TheatreWorkspace /> : null}
          {activeScreen === 'Maternity' ? <MaternityServiceLine /> : null}
          {activeScreen === 'ICU' ? <IpdModule initialWardType="icu" /> : null}
          {activeScreen === 'HDU' ? <IpdModule initialWardType="hdu" /> : null}
          {activeScreen === 'Operations Center' ? <OperationsCommandCenter /> : null}
          {activeScreen === 'Worklists' ? <OperationalWorklists /> : null}
          {activeScreen === 'Notifications' ? (
            <NotificationInbox onNavigate={goToScreen} />
          ) : null}
          {activeScreen === 'Hospital Control Center' ? <HospitalControlCenter /> : null}
          {activeScreen !== 'Patient Search' &&
          activeScreen !== 'Register Patient' &&
          activeScreen !== 'Patient Timeline' &&
          activeScreen !== 'OPD Check-In' &&
          activeScreen !== 'Triage Queue' &&
          activeScreen !== 'OPD Patients' &&
          activeScreen !== 'Doctor Queue' &&
          activeScreen !== 'Lab Dashboard' &&
          activeScreen !== 'Laboratory' &&
          activeScreen !== 'Lab Patients' &&
          activeScreen !== 'Imaging Dashboard' &&
          activeScreen !== 'Radiology' &&
          activeScreen !== 'Imaging Patients' &&
          activeScreen !== 'Results Inbox' &&
          activeScreen !== 'Appointments' &&
          activeScreen !== 'Referrals' &&
          activeScreen !== 'Medical Documents' &&
          activeScreen !== 'Hospital Library' &&
          activeScreen !== 'Sick Sheets' &&
          activeScreen !== 'OPD Reports' &&
          activeScreen !== 'Operations Center' &&
          activeScreen !== 'Worklists' &&
          activeScreen !== 'Notifications' &&
          activeScreen !== 'Inpatient (IPD)' &&
          activeScreen !== 'Nursing' &&
          activeScreen !== 'IPD Patients' &&
          activeScreen !== 'Emergency' &&
          activeScreen !== 'ED Patients' &&
          activeScreen !== 'Clinical Reports' &&
          activeScreen !== 'Executive Analytics' &&
          activeScreen !== 'Clinical Orders' &&
          activeScreen !== 'Pharmacy' &&
          activeScreen !== 'Theatre' &&
          activeScreen !== 'Maternity' &&
          activeScreen !== 'ICU' &&
          activeScreen !== 'HDU' &&
          activeScreen !== 'Hospital Control Center' ? (
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
  const { data: catalog } = useClinicalCatalog()
  const brand = resolveHospitalBranding(catalog)

  useEffect(() => {
    if (HIDE_TENANT_SELECTOR && props.tenant !== DEFAULT_TENANT) {
      props.setTenant(DEFAULT_TENANT)
    }
  }, [props.tenant, props.setTenant])

  const initialResetToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('resetToken')
      : null
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(
    initialResetToken ? 'reset' : 'login',
  )
  const [resetToken, setResetToken] = useState(initialResetToken ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [email, setEmail] = useState(import.meta.env.DEV ? 'it@jalaram.co.ke' : '')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<string | null>(null)
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

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ message: string; resetToken?: string }>(
        '/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) },
      )
      if (result.resetToken) {
        setInfo(`${result.message} Dev token: ${result.resetToken}`)
      } else {
        setInfo(result.message)
      }
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      })
      setInfo('Password updated. Sign in with your new password.')
      setMode('login')
      setPassword('')
      setNewPassword('')
    },
  })

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: `linear-gradient(160deg, ${brand.primaryColor ?? '#0f766e'} 0%, #0f172a 100%)` }}
    >
      <form
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          if (mode === 'forgot') {
            forgotMutation.mutate()
            return
          }
          if (mode === 'reset') {
            resetMutation.mutate()
            return
          }
          mutation.mutate()
        }}
      >
        <div className="mb-8">
          <HospitalBrandMark showFacility={false} />
        </div>
        {mode === 'reset' ? (
          <>
            <label className="mb-4 block">
              <span className="text-sm font-semibold text-slate-700">Reset token</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
              />
            </label>
            <label className="mb-6 block">
              <span className="text-sm font-semibold text-slate-700">New password</span>
              <div className="mt-2">
                <PasswordInput
                  className="rounded-xl border-slate-300 px-4 py-3"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </label>
          </>
        ) : (
          <>
        {!HIDE_TENANT_SELECTOR ? (
        <label className="mb-4 block">
          <span className="text-sm font-semibold text-slate-700">Hospital code</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            value={props.tenant}
            onChange={(event) => props.setTenant(event.target.value)}
          />
        </label>
        ) : null}
        <label className="mb-4 block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {mode === 'login' ? (
        <label className="mb-6 block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <div className="mt-2">
            <PasswordInput
              className="rounded-xl border-slate-300 px-4 py-3"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
        </label>
        ) : null}
          </>
        )}
        {info ? (
          <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-800">{info}</p>
        ) : null}
        {(mutation.error || forgotMutation.error || resetMutation.error) ? (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {(mutation.error ?? forgotMutation.error ?? resetMutation.error)?.message}
          </p>
        ) : null}
        <button
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
          disabled={mutation.isPending || forgotMutation.isPending || resetMutation.isPending}
        >
          {mode === 'forgot'
            ? forgotMutation.isPending
              ? 'Sending…'
              : 'Send reset link'
            : mode === 'reset'
              ? resetMutation.isPending
                ? 'Updating…'
                : 'Set new password'
              : mutation.isPending
                ? 'Signing in...'
                : 'Sign in'}
        </button>
        <div className="mt-4 text-center text-sm">
          {mode === 'login' ? (
            <button
              type="button"
              className="font-semibold text-teal-700 hover:underline"
              onClick={() => {
                setMode('forgot')
                setInfo(null)
              }}
            >
              Forgot password?
            </button>
          ) : (
            <button
              type="button"
              className="font-semibold text-teal-700 hover:underline"
              onClick={() => {
                setMode('login')
                setInfo(null)
              }}
            >
              Back to sign in
            </button>
          )}
        </div>
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
  const setSession = useAuthStore((state) => state.setSession)
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest<{
        changed: boolean
        accessToken: string
        refreshToken: string
        user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>
      }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword: form.get('newPassword'),
        }),
      })
    },
    onSuccess: (result) => {
      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      })
      setMessage('Password updated. Continuing to your workspace…')
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950 p-6">
      <form
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate(event.currentTarget)
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

function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    const handler = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail
      setNotifications((current) => [notification, ...current].slice(0, 5))
      window.setTimeout(() => {
        setNotifications((current) =>
          current.filter((item) => item.id !== notification.id),
        )
      }, notification.severity === 'critical' ? 10000 : 6000)
    }
    window.addEventListener('afyasasa-notification', handler)
    return () => window.removeEventListener('afyasasa-notification', handler)
  }, [])

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 flex w-auto max-w-[min(100vw-1.5rem,24rem)] flex-col gap-3 sm:right-4 sm:top-4">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl ${
            notification.severity === 'critical'
              ? 'border-red-200 bg-red-50 text-red-900'
              : notification.severity === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : notification.severity === 'success'
                  ? 'border-green-200 bg-green-50 text-green-900'
                  : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{notification.title}</p>
              <p className="mt-1 text-sm">{notification.body}</p>
            </div>
            <button
              className="text-sm font-bold opacity-70"
              onClick={() =>
                setNotifications((current) =>
                  current.filter((item) => item.id !== notification.id),
                )
              }
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function PatientSearch({
  onSelect,
}: {
  onSelect: (patient: PatientSummary) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr] animate-fade-in">
      <Card>
        <PageHeader
          eyebrow="Reception"
          title="Patient search"
          description="Search as you type. Open a profile to view allergies, timeline, and printable ID."
        />
        <PatientSearchBrowse onSelect={(patient) => onSelect(patient as PatientSummary)} />
      </Card>

      <Card className="bg-gradient-to-br from-teal-900 to-teal-800 text-white">
        <Activity className="mb-3 text-teal-200" />
        <h3 className="text-lg font-bold">Before you register</h3>
        <ul className="mt-4 space-y-2.5 text-sm text-teal-100">
          <li>Search by name, phone, patient number, or national ID.</li>
          <li>Only register a new patient if no match appears.</li>
          <li>Every change is audited — duplicates cause clinical risk.</li>
          <li>Use the profile drawer to print a QR patient ID card.</li>
        </ul>
      </Card>
    </div>
  )
}

function PatientTimelineScreen({
  onOpenProfile,
}: {
  onOpenProfile: (patientId: string) => void
}) {
  const [selected, setSelected] = useState<PatientSummary | null>(null)
  const { data: timeline } = useQuery({
    queryKey: ['full-patient-timeline', selected?.id],
    queryFn: () =>
      apiRequest<{
        events: { id?: string; type: string; occurredAt: string; title: string; summary: string }[]
      }>(`/patients/${selected!.id}/timeline`),
    enabled: Boolean(selected?.id),
  })
  const { data: journey } = useQuery({
    queryKey: ['timeline-journey', selected?.id],
    queryFn: () =>
      apiRequest<{ step: WorkflowStep; pregnancyAlert: boolean; criticalLabAlert: boolean }>(
        `/patients/${selected!.id}/journey`,
      ),
    enabled: Boolean(selected?.id),
  })

  return (
    <div className="grid max-w-6xl gap-6 animate-fade-in">
      <Card>
        <PageHeader
          eyebrow="Clinical record"
          title="Patient timeline"
          description="Search a patient to view their full chronological journey."
        />
        <PatientSearchAutocomplete
          selected={selected}
          onSelect={(patient) => setSelected(patient as PatientSummary | null)}
        />
      </Card>
      {selected ? (
        <>
          <PatientContextHeader
            patient={selected}
            workflowStep={journey?.step}
            pregnancyAlert={journey?.pregnancyAlert}
            criticalLabAlert={journey?.criticalLabAlert}
          />
          <PatientTimeline
            events={timeline?.events ?? []}
            onSelect={() => onOpenProfile(selected.id)}
          />
        </>
      ) : null}
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
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
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
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
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
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
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
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
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

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto overscroll-contain border-l border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
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

          <div className="mt-6">
            <PatientContextHeader patient={patient} sticky={false} showWorkflow={false} />
          </div>

          <section className="mt-6">
            <PatientTimeline events={timeline?.events ?? []} title="Clinical timeline" />
          </section>

          <section className="patient-card-print-area mt-6">
            <div className="flex items-center justify-between print:hidden">
              <p className="text-xs font-bold uppercase text-slate-500">Patient card</p>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Print card
              </button>
            </div>
            {qrCard && patient ? (
              <div className="mt-4 max-w-md">
                <PatientCardPrint
                  patient={{
                    patientNo: patient.patientNo,
                    firstName: patient.firstName,
                    lastName: patient.lastName,
                    dateOfBirth: patient.dateOfBirth,
                    gender: patient.gender,
                    bloodGroup: patient.bloodGroup,
                    primaryPhone: patient.primaryPhone,
                    qrDataUrl: qrCard.qrDataUrl,
                    qrCode: qrCard.qrCode,
                    nextOfKin: patient.nextOfKin?.find((k) => k.isEmergencyContact) ?? patient.nextOfKin?.[0] ?? null,
                  }}
                  qr={{ qrDataUrl: qrCard.qrDataUrl, qrCode: qrCard.qrCode }}
                />
              </div>
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

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <QuickAddForm
              title="Add identifier"
              pending={addIdentifier.isPending}
              onSubmit={(event) => {
                event.preventDefault()
                addIdentifier.mutate(event.currentTarget)
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
                addNok.mutate(event.currentTarget)
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
                addAllergy.mutate(event.currentTarget)
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
                addCondition.mutate(event.currentTarget)
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
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={onSubmit}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{title}</p>
      {children}
      <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
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

interface TriageRecord {
  colour: string
  category?: string
  chiefComplaint?: string
  painScore?: number | null
  temperature?: string | number | null
  pulse?: number | null
  respiratoryRate?: number | null
  bpSystolic?: number | null
  bpDiastolic?: number | null
  spo2?: number | null
  weight?: string | number | null
  height?: string | number | null
}

interface EncounterItem {
  id: string
  encounterNo: string
  status: string
  presentingComplaint: string
  startedAt: string
  patient: PatientSummary
  triage?: TriageRecord | null
  consultation?: { id: string; status: string } | null
}

function DoctorQueue() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<EncounterItem | null>(null)
  const [recentSoap, setRecentSoap] = useState<Array<{ id: string; patient: string; savedAt: string }>>([])
  const { data: queue = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => apiRequest<EncounterItem[]>('/opd/doctor/queue'),
  })
  const createConsultation = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
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
    onSuccess: async (consultation) => {
      setRecentSoap((current) =>
        [
          {
            id: consultation.id,
            patient: selected
              ? `${selected.patient.firstName} ${selected.patient.lastName}`
              : 'Patient',
            savedAt: new Date().toLocaleTimeString(),
          },
          ...current,
        ].slice(0, 5),
      )
      emitAppNotification({
        title: 'SOAP saved',
        body: 'Consultation saved. The patient remains available here for orders, diagnosis, referral, or discharge.',
        severity: 'success',
      })
      await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
  })
  const addDiagnosis = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
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
  const createReferral = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selected?.patient.id,
          encounterId: selected?.id,
          type: form.get('type'),
          targetDepartment: form.get('targetDepartment') || undefined,
          targetFacility: form.get('targetFacility') || undefined,
          reason: form.get('reason'),
          letter: form.get('letter'),
        }),
      })
    },
    onSuccess: () =>
      emitAppNotification({
        title: 'Referral created',
        body: 'Referral letter has been recorded for this patient.',
        severity: 'success',
      }),
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] animate-fade-in">
      <div className="space-y-2">
        <PageHeader
          title="Doctor queue"
          description={`${queue.length} waiting · triage colour = urgency`}
        />
        <div className="max-h-[min(70vh,36rem)] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-10rem)]">
          {queue.map((encounter) => (
            <button
              key={encounter.id}
              type="button"
              className={`w-full rounded-lg border-l-4 px-3 py-2.5 text-left shadow-sm transition duration-150 hover:shadow-md ${triageCardAccent(encounter.triage?.colour)} ${
                selected?.id === encounter.id ? 'ring-2 ring-teal-500' : ''
              }`}
              onClick={() => setSelected(encounter)}
            >
              <div className="flex items-center justify-between gap-2">
                <TriageIndicator colour={encounter.triage?.colour} label="Triage" size="sm" />
                <TriageBadge colour={encounter.triage?.colour} />
              </div>
              <h3 className="mt-1.5 truncate text-sm font-bold leading-tight">
                {encounter.patient.firstName} {encounter.patient.lastName}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                {encounter.triage?.chiefComplaint ?? encounter.presentingComplaint ?? '—'}
              </p>
            </button>
          ))}
          {!queue.length ? (
            <Card className="p-4">
              <p className="py-6 text-center text-sm text-slate-500">No patients in queue.</p>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        {selected ? (
          <DoctorConsultationWorkspace
            selected={selected}
            createConsultation={{
              mutate: (form) => createConsultation.mutate(form),
              isPending: createConsultation.isPending,
            }}
            addDiagnosis={addDiagnosis}
            completeEncounter={completeEncounter}
            createReferral={createReferral}
            recentSoap={recentSoap}
          />
        ) : (
          <Card>
            <p className="py-16 text-center text-slate-500">Select a patient from the doctor queue.</p>
          </Card>
        )}
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

function ResultsInbox() {
  const queryClient = useQueryClient()
  const { data: labResults = [] } = useQuery({
    queryKey: ['lab-results-inbox'],
    queryFn: () => apiRequest<LabInboxItem[]>('/laboratory/results/inbox'),
  })
  const { data: criticalResults = [] } = useQuery({
    queryKey: ['critical-results'],
    queryFn: () => apiRequest<LabInboxItem[]>('/laboratory/results/critical'),
  })
  const { data: radiologyReports = [] } = useQuery({
    queryKey: ['radiology-reports-inbox'],
    queryFn: () => apiRequest<RadiologyInboxItem[]>('/radiology/reports/inbox'),
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
      <ReviewList title="Verified lab results" items={labResults} kind="lab" onReview={reviewLab.mutate} />
      <ReviewList title="Critical lab results" items={criticalResults} kind="lab" onReview={reviewLab.mutate} />
      <ReviewList title="Radiology reports" items={radiologyReports} kind="radiology" onReview={reviewRadiology.mutate} />
    </div>
  )
}

type LabInboxItem = {
  id: string
  value?: string
  flag?: string
  reviewedAt?: string | null
  requestItem?: {
    test?: { name: string } | null
    panel?: { name: string } | null
    request?: {
      requestNo?: string
      patient?: { firstName: string; lastName: string; patientNo: string }
    }
  }
}

type RadiologyInboxItem = {
  id: string
  impression?: string
  reviewedAt?: string | null
  request?: {
    requestNo?: string
    patient?: { firstName: string; lastName: string; patientNo: string }
    modality?: { name: string }
  }
}

type InboxItem = LabInboxItem | RadiologyInboxItem

function ReviewList({
  title,
  items,
  kind,
  onReview,
}: {
  title: string
  items: InboxItem[]
  kind: 'lab' | 'radiology'
  onReview: (id: string) => void
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const labItem = kind === 'lab' ? (item as LabInboxItem) : null
          const radItem = kind === 'radiology' ? (item as RadiologyInboxItem) : null
          const patient = labItem?.requestItem?.request?.patient ?? radItem?.request?.patient
          const requestNo = labItem?.requestItem?.request?.requestNo ?? radItem?.request?.requestNo
          const testName =
            labItem?.requestItem?.test?.name ??
            labItem?.requestItem?.panel?.name ??
            radItem?.request?.modality?.name

          return (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              {patient ? (
                <p className="font-semibold text-slate-900">
                  {patient.firstName} {patient.lastName}
                  <span className="ml-2 text-sm font-normal text-slate-500">{patient.patientNo}</span>
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                {[requestNo, testName].filter(Boolean).join(' · ') || 'Clinical result'}
              </p>
              <p className="mt-1 font-semibold">
                {radItem?.impression ?? `${labItem?.value ?? ''} ${labItem?.flag ?? ''}`.trim()}
              </p>
              <button
                className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                disabled={Boolean(item.reviewedAt)}
                onClick={() => onReview(item.id)}
              >
                {item.reviewedAt ? 'Reviewed' : 'Mark reviewed'}
              </button>
            </div>
          )
        })}
        {!items.length ? <p className="text-sm text-slate-500">No items.</p> : null}
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
