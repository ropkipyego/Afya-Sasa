import { useState } from 'react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import {
  Activity,
  Bell,
  Building2,
  ClipboardList,
  FlaskConical,
  Heart,
  Palette,
  Scan,
  Settings,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react'
import { PageHeader } from '../ui'
import { HospitalProfilePanel } from './panels/HospitalProfilePanel'
import { ClinicalConfigPanel } from './panels/ClinicalConfigPanel'
import { SystemHealthPanel } from './panels/SystemHealthPanel'
import { WardManagementPanel } from './panels/WardManagementPanel'
import { LabCatalogPanel } from './panels/LabCatalogPanel'
import { RadiologyCatalogPanel } from './panels/RadiologyCatalogPanel'
import { TheatreCatalogPanel } from './panels/TheatreCatalogPanel'
import { MaternityConfigPanel } from './panels/MaternityConfigPanel'
import { NotificationsConfigPanel } from './panels/NotificationsConfigPanel'
import { ReportingCenterPanel } from './panels/ReportingCenterPanel'
import { BrandingPanel } from './panels/BrandingPanel'
import { SuperAdminPanel } from './panels/SuperAdminPanel'

export type ControlCenterSection =
  | 'organization'
  | 'users'
  | 'roles'
  | 'clinical'
  | 'wards'
  | 'laboratory'
  | 'radiology'
  | 'theatre'
  | 'maternity'
  | 'notifications'
  | 'reporting'
  | 'audit'
  | 'system'
  | 'branding'
  | 'superadmin'

const sections: {
  id: ControlCenterSection
  label: string
  icon: ReactNode
  group: string
}[] = [
  { id: 'organization', label: 'Hospital profile', icon: <Building2 className="h-4 w-4" />, group: 'Organization' },
  { id: 'users', label: 'Staff & users', icon: <Users className="h-4 w-4" />, group: 'Users & security' },
  { id: 'roles', label: 'Roles & permissions', icon: <Shield className="h-4 w-4" />, group: 'Users & security' },
  { id: 'clinical', label: 'Clinical catalog', icon: <Stethoscope className="h-4 w-4" />, group: 'Clinical configuration' },
  { id: 'wards', label: 'Wards & beds', icon: <Heart className="h-4 w-4" />, group: 'Facilities' },
  { id: 'laboratory', label: 'Laboratory catalog', icon: <FlaskConical className="h-4 w-4" />, group: 'Service catalogs' },
  { id: 'radiology', label: 'Radiology catalog', icon: <Scan className="h-4 w-4" />, group: 'Service catalogs' },
  { id: 'theatre', label: 'Theatre config', icon: <Activity className="h-4 w-4" />, group: 'Service catalogs' },
  { id: 'maternity', label: 'Maternity config', icon: <Heart className="h-4 w-4" />, group: 'Service catalogs' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, group: 'Communications' },
  { id: 'reporting', label: 'Reporting center', icon: <ClipboardList className="h-4 w-4" />, group: 'Reports' },
  { id: 'audit', label: 'Audit & compliance', icon: <Shield className="h-4 w-4" />, group: 'Governance' },
  { id: 'system', label: 'System health', icon: <Settings className="h-4 w-4" />, group: 'Operations' },
  { id: 'branding', label: 'Branding & theme', icon: <Palette className="h-4 w-4" />, group: 'Operations' },
  { id: 'superadmin', label: 'Super admin', icon: <Settings className="h-4 w-4" />, group: 'Operations' },
]

export function HospitalControlCenter({
  usersPanel,
  rolesPanel,
  auditPanel,
}: {
  usersPanel: ReactNode
  rolesPanel: ReactNode
  auditPanel: ReactNode
}) {
  const [section, setSection] = useState<ControlCenterSection>('organization')

  const groups = Array.from(new Set(sections.map((s) => s.group)))

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      <PageHeader
        eyebrow="Administration"
        title="Hospital control center"
        description="Configure the hospital operating system — one place for organization, clinical catalogs, facilities, security, and system health."
      />

      <div className="flex flex-col gap-10 xl:flex-row xl:items-start">
        <nav className="shrink-0 xl:w-72">
          <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group}
                </p>
                <ul className="space-y-1">
                  {sections
                    .filter((s) => s.group === group)
                    .map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSection(item.id)}
                          className={clsx(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition',
                            section === item.id
                              ? 'bg-teal-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {section === 'organization' && <HospitalProfilePanel />}
          {section === 'users' && usersPanel}
          {section === 'roles' && rolesPanel}
          {section === 'clinical' && <ClinicalConfigPanel />}
          {section === 'wards' && <WardManagementPanel />}
          {section === 'laboratory' && <LabCatalogPanel />}
          {section === 'radiology' && <RadiologyCatalogPanel />}
          {section === 'theatre' && <TheatreCatalogPanel />}
          {section === 'maternity' && <MaternityConfigPanel />}
          {section === 'notifications' && <NotificationsConfigPanel />}
          {section === 'reporting' && <ReportingCenterPanel />}
          {section === 'audit' && auditPanel}
          {section === 'system' && <SystemHealthPanel />}
          {section === 'branding' && <BrandingPanel />}
          {section === 'superadmin' && <SuperAdminPanel />}
        </div>
      </div>
    </div>
  )
}
