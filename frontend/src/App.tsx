import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
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
  TriageBadge,
  TriageIndicator,
  triageCardAccent,
} from './components/ui'
import { PatientContextHeader } from './components/PatientContextHeader'
import { PatientRegistrationForm } from './components/PatientRegistrationForm'
import { DoctorConsultationWorkspace } from './components/DoctorConsultationWorkspace'
import { PatientTimeline } from './components/PatientTimeline'
import { IpdModule } from './components/ipd/IpdModule'
import { IcuModule } from './components/icu/IcuModule'
import { HduModule } from './components/hdu/HduModule'
import { HospitalControlCenter } from './components/admin/HospitalControlCenter'
import { HospitalBrandMark, HospitalFacilityBadge } from './components/branding/HospitalBrandMark'
import { useClinicalCatalog } from './hooks/useClinicalCatalog'
import { resolveHospitalBranding } from './lib/hospital-configuration'
import { OpdCheckInWorkspace } from './components/opd/OpdCheckInWorkspace'
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
import { TheatreWorkspace } from './components/theatre/TheatreWorkspace'
import { PatientCardPrint } from './components/patients/PatientCardPrint'
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
  const [notificationOpen, setNotificationOpen] = useState(false)
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
          {activeScreen === 'Register Patient' ? <PatientRegistrationForm /> : null}
          {activeScreen === 'OPD Check-In' ? <OpdCheckInWorkspace /> : null}
          {activeScreen === 'Triage Queue' ? <TriageWorkspace /> : null}
          {activeScreen === 'Worklists' ? (
            <OperationalWorklists onOpenPatient={setSelectedPatientId} initialModule="opd" />
          ) : null}
          {activeScreen === 'Doctor Queue' ? <DoctorQueue /> : null}
          {activeScreen === 'Laboratory' ? <LabModule /> : null}
          {activeScreen === 'Radiology' ? <ImagingModule /> : null}
          {activeScreen === 'Appointments' ? <AppointmentCenter /> : null}
          {activeScreen === 'Referrals' ? <ReferralWorkspace /> : null}
          {activeScreen === 'Medical Documents' ? <MedicalDocumentsCenter /> : null}
          {activeScreen === 'Hospital Library' ? <HospitalLibrary /> : null}
          {activeScreen === 'Sick Sheets' ? <SickSheetWorkspace /> : null}
          {activeScreen === 'Reports' ? <ReportsHub /> : null}
          {activeScreen === 'Inpatient (IPD)' ? <IpdModule /> : null}
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
            <PatientProfileDrawer
              patientId={selectedPatientId}
              onClose={() => setSelectedPatientId(null)}
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

  useEffect(() => {
    const handler = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail
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
