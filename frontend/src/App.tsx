import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  KeyRound,
  LogOut,
  Menu,
} from 'lucide-react'
import {
  Card,
  Field,
  NavGroup,
  PageHeader,
  TriageBadge,
  TriageIndicator,
  triageCardAccent,
} from './components/ui'
import { PatientRegistrationForm } from './components/PatientRegistrationForm'
import { DoctorConsultationWorkspace } from './components/DoctorConsultationWorkspace'
import { IpdModule } from './components/ipd/IpdModule'
import { IcuModule } from './components/icu/IcuModule'
import { HduModule } from './components/hdu/HduModule'
import { HospitalControlCenter } from './components/admin/HospitalControlCenter'
import { HospitalBrandMark, HospitalFacilityBadge } from './components/branding/HospitalBrandMark'
import { useClinicalCatalog } from './hooks/useClinicalCatalog'
import { resolveHospitalBranding } from './lib/hospital-configuration'
import { PaymentDesk } from './components/payments/PaymentDesk'
import { OpdCheckInWorkspace, type CheckInPatient } from './components/opd/OpdCheckInWorkspace'
import { TriageWorkspace } from './components/opd/TriageWorkspace'
import { AppointmentCenter } from './components/appointments/AppointmentCenter'
import { ReferralWorkspace } from './components/referrals/ReferralWorkspace'
import { LabModule } from './components/investigations/LabModule'
import { ImagingModule } from './components/investigations/ImagingModule'
import { OrdersHub } from './components/orders/OrdersHub'
import { PharmacyModule } from './components/orders/PharmacyModule'
import { ReportsHub } from './components/reports/ReportsHub'
import { GlobalPatientSearch } from './components/layout/GlobalPatientSearch'
import { resolveScreen } from './lib/screen-aliases'
import { InventoryModule } from './components/inventory/InventoryModule'
import { MedicalDocumentsCenter } from './components/documents/MedicalDocumentsCenter'
import { HospitalLibrary } from './components/documents/HospitalLibrary'
import { SickSheetWorkspace } from './components/documents/SickSheetWorkspace'
import { MaternityServiceLine } from './components/maternity/MaternityServiceLine'
import { EmergencyCommandCenter } from './components/emergency/EmergencyCommandCenter'
import { NotificationInbox } from './components/notifications/NotificationInbox'
import { OperationalWorklists } from './components/worklists/OperationalWorklists'
import { PatientRegistry } from './components/patients/PatientRegistry'
import { TheatreWorkspace } from './components/theatre/TheatreWorkspace'
import { PatientFileModal } from './components/patients/PatientFileModal'
import { PatientQrLanding } from './components/patients/PatientQrLanding'
import { WorkflowBadge } from './components/WorkflowBadge'
import { mapEncounterStatusToWorkflow } from './lib/workflow-status'
import { useHospitalSync } from './hooks/useHospitalSync'
import { formDataFromElement } from './lib/form-utils'
import { apiRequest } from './lib/api'
import { useAuthStore } from './lib/auth-store'
import { useAuthSession } from './hooks/useAuthSession'
import { LoginScreen } from './components/auth/LoginScreen'
import { SINGLE_TENANT_MODE } from './lib/tenant-config'

import { filterNavigationByModules } from './lib/nav-module-filter'
import { navigation, workflowDescriptions } from './lib/navigation'
import { AppMobileNav } from './components/layout/AppMobileNav'
import { UserSettingsMenu } from './components/layout/UserSettingsMenu'
import { playNotificationSound } from './lib/notification-sound'

const KNOWN_SCREENS = new Set(navigation.map((item) => item.label))

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
    return resolveScreen(saved || 'OPD Check-In')
  })
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [checkInPatient, setCheckInPatient] = useState<CheckInPatient | null>(null)
  const [ipdFocusAdmissionId, setIpdFocusAdmissionId] = useState<string | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem('afyasasa.sidebarOpen') !== 'false',
  )
  const greeting = `${greetingForNow()} ${user?.firstName ?? ''}`.trim()

  const goToScreen = (screen: string) => {
    const next = resolveScreen(screen?.trim())
    if (!next) return
    setActiveScreen(next)
    setNotificationOpen(false)
  }

  useEffect(() => {
    if (activeScreen.trim()) {
      sessionStorage.setItem('afyasasa.activeScreen', activeScreen)
    }
  }, [activeScreen])

  useEffect(() => {
    localStorage.setItem('afyasasa.sidebarOpen', String(sidebarOpen))
  }, [sidebarOpen])

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

  const scanCode = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)?.[1]

  if (!hydrated) {
    return <SessionLoadingScreen />
  }

  if (scanCode) {
    return <PatientQrLanding code={decodeURIComponent(scanCode)} />
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
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200/80 bg-white shadow-sm transition-transform duration-200 xl:flex',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <HospitalBrandMark />
            {!SINGLE_TENANT_MODE ? <HospitalFacilityBadge label={tenant} /> : null}
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {Object.entries(groupedNavigation).map(([group, items]) => (
            <NavGroup key={group} title={group} defaultOpen={group === 'Front Office' || group === 'Outpatient'}>
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

      <main
        className={clsx(
          'min-h-dvh w-full min-w-0 max-w-full overflow-x-hidden transition-[padding] duration-200',
          sidebarOpen && 'xl:pl-72',
        )}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 md:px-5">
            {!sidebarOpen ? (
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm xl:inline-flex"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : null}
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
                  — welcome to Afyasasa
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
                onClick={() => setNotificationOpen(true)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {(notificationSummary?.unread ?? 0) > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notificationSummary!.unread > 9 ? '9+' : notificationSummary!.unread}
                  </span>
                ) : null}
              </button>
              <UserSettingsMenu />
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

        <section className="min-h-[calc(100dvh-4.5rem)] w-full min-w-0 max-w-full overflow-x-hidden p-3 pb-24 sm:p-4 sm:pb-24 md:p-6 md:pb-24">
          {activeScreen === 'Register Patient' ? (
            <PatientRegistrationForm
              onViewPatient={setSelectedPatientId}
              onQuickCheckIn={(patient) => {
                setCheckInPatient(patient)
                goToScreen('OPD Check-In')
              }}
            />
          ) : null}
          {activeScreen === 'OPD Check-In' ? (
            <OpdCheckInWorkspace
              initialPatient={checkInPatient}
              onInitialPatientConsumed={() => setCheckInPatient(null)}
              onViewPatient={setSelectedPatientId}
              onOpenTriage={() => goToScreen('Triage Queue')}
            />
          ) : null}
          {activeScreen === 'Payments' ? <PaymentDesk /> : null}
          {activeScreen === 'Triage Queue' ? <TriageWorkspace /> : null}
          {activeScreen === 'Patient Registry' ? (
            <PatientRegistry onOpenPatient={setSelectedPatientId} />
          ) : null}
          {activeScreen === 'Care Queues' || activeScreen === 'Worklists' ? (
            <OperationalWorklists onOpenPatient={setSelectedPatientId} initialModule="opd" />
          ) : null}
          {activeScreen === 'Doctor Queue' ? (
            <DoctorQueue
              onOpenIpd={(admissionId) => {
                setIpdFocusAdmissionId(admissionId)
                goToScreen('Inpatient (IPD)')
              }}
              onOpenSickSheets={() => goToScreen('Sick Sheets')}
            />
          ) : null}
          {activeScreen === 'Laboratory' ? <LabModule /> : null}
          {activeScreen === 'Radiology' ? <ImagingModule /> : null}
          {activeScreen === 'Appointments' ? <AppointmentCenter /> : null}
          {activeScreen === 'Referrals' ? <ReferralWorkspace /> : null}
          {activeScreen === 'Medical Documents' ? <MedicalDocumentsCenter /> : null}
          {activeScreen === 'Hospital Library' ? <HospitalLibrary /> : null}
          {activeScreen === 'Sick Sheets' ? <SickSheetWorkspace /> : null}
          {activeScreen === 'Reports' ? <ReportsHub /> : null}
          {activeScreen === 'Inpatient (IPD)' ? (
            <IpdModule
              initialAdmissionId={ipdFocusAdmissionId ?? undefined}
              onInitialAdmissionConsumed={() => setIpdFocusAdmissionId(null)}
            />
          ) : null}
          {activeScreen === 'Nursing' ? <IpdModule initialScreen="nursing" /> : null}
          {activeScreen === 'Emergency' ? <EmergencyCommandCenter /> : null}
          {activeScreen === 'Orders' ? <OrdersHub /> : null}
          {activeScreen === 'Pharmacy' ? <PharmacyModule /> : null}
          {activeScreen === 'Inventory & Store' ? <InventoryModule /> : null}
          {activeScreen === 'Theatre' ? <TheatreWorkspace /> : null}
          {activeScreen === 'Maternity' ? <MaternityServiceLine /> : null}
          {activeScreen === 'ICU' ? <IcuModule /> : null}
          {activeScreen === 'HDU' ? <HduModule /> : null}
          {activeScreen === 'Hospital Control Center' ? <HospitalControlCenter /> : null}
          {!KNOWN_SCREENS.has(activeScreen) ? <Placeholder screen={activeScreen} /> : null}
          {selectedPatientId ? (
            <PatientFileModal
              patientId={selectedPatientId}
              onClose={() => setSelectedPatientId(null)}
              onQuickCheckIn={(patient) => {
                setCheckInPatient(patient)
                setSelectedPatientId(null)
                goToScreen('OPD Check-In')
              }}
            />
          ) : null}
          {notificationOpen ? (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-16 backdrop-blur-sm">
              <div className="max-h-[85dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-2xl">
                <NotificationInbox
                  onNavigate={goToScreen}
                  onClose={() => setNotificationOpen(false)}
                />
              </div>
            </div>
          ) : null}
        </section>
        <GlobalPatientSearch onSelectPatient={setSelectedPatientId} />
      </main>
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
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <form
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60"
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
  const previousUnread = useRef(0)

  const { data: inboxSummary } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => apiRequest<{ unread: number }>('/notifications/inbox/summary'),
    refetchInterval: 15_000,
  })

  useEffect(() => {
    const unread = inboxSummary?.unread ?? 0
    if (unread > previousUnread.current && previousUnread.current >= 0) {
      playNotificationSound(unread - previousUnread.current > 2 ? 'critical' : 'warning')
    }
    previousUnread.current = unread
  }, [inboxSummary?.unread])

  useEffect(() => {
    const handler = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail
      playNotificationSound(notification.severity ?? 'info')
      const duration = notification.severity === 'critical' ? 10000 : 6000
      setNotifications((current) =>
        [{ ...notification, _duration: duration } as AppNotification & { _duration?: number }, ...current].slice(
          0,
          5,
        ),
      )
      window.setTimeout(() => {
        setNotifications((current) =>
          current.filter((item) => item.id !== notification.id),
        )
      }, duration)
    }
    window.addEventListener('afyasasa-notification', handler)
    return () => window.removeEventListener('afyasasa-notification', handler)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[130] flex flex-col gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-md">
      {notifications.map((notification) => {
        const duration =
          (notification as AppNotification & { _duration?: number })._duration ??
          (notification.severity === 'critical' ? 10000 : 6000)
        return (
          <div
            key={notification.id}
            className={`toast-slide-in pointer-events-auto overflow-hidden rounded-2xl border shadow-2xl ${
              notification.severity === 'critical'
                ? 'border-red-200 bg-red-50 text-red-900'
                : notification.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : notification.severity === 'success'
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3 p-4">
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
                ×
              </button>
            </div>
            <div className="h-1 w-full bg-black/5">
              <div
                className="toast-countdown h-full bg-current opacity-40"
                style={{ animationDuration: `${duration}ms` }}
              />
            </div>
          </div>
        )
      })}
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
  assignedToMe?: boolean
  attendingDoctor?: { id: string; firstName: string; lastName: string } | null
}

function DoctorQueue({
  onOpenIpd,
  onOpenSickSheets,
}: {
  onOpenIpd: (admissionId: string) => void
  onOpenSickSheets: () => void
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<EncounterItem | null>(null)
  const [recentSoap, setRecentSoap] = useState<Array<{ id: string; patient: string; savedAt: string }>>([])
  const { data: queue = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => apiRequest<EncounterItem[]>('/opd/doctor/queue'),
    refetchInterval: 20_000,
  })

  useEffect(() => {
    if (!selected) return
    const fresh = queue.find((encounter) => encounter.id === selected.id)
    if (fresh && fresh.status !== selected.status) {
      setSelected(fresh)
    }
  }, [queue, selected])
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
          description={`${queue.length} active · triaged, in consultation, awaiting results`}
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
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <WorkflowBadge step={mapEncounterStatusToWorkflow(encounter.status)} />
                  <TriageBadge colour={encounter.triage?.colour} />
                </div>
              </div>
              <h3 className="mt-1.5 truncate text-sm font-bold leading-tight">
                {encounter.patient.firstName} {encounter.patient.lastName}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                {encounter.triage?.chiefComplaint ?? encounter.presentingComplaint ?? '—'}
              </p>
              {encounter.attendingDoctor ? (
                <p className="mt-1 text-[10px] font-medium text-slate-500">
                  Assigned: Dr. {encounter.attendingDoctor.firstName} {encounter.attendingDoctor.lastName}
                  {encounter.assignedToMe === false ? ' · other doctor' : ''}
                </p>
              ) : (
                <p className="mt-1 text-[10px] font-medium text-teal-700">Unassigned — any doctor</p>
              )}
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
            onOpenIpd={onOpenIpd}
            onOpenSickSheets={onOpenSickSheets}
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
