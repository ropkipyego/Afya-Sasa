import { useState } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { PageHeader } from '../ui'
import { ControlCenterHome } from './ControlCenterHome'
import { findControlCenterCard } from './control-center-sections'
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
import { FacilitiesModulesPanel } from './panels/FacilitiesModulesPanel'
import { DepartmentsClinicsPanel } from './panels/DepartmentsClinicsPanel'
import { DocumentTemplatesPanel } from './panels/DocumentTemplatesPanel'
import { HospitalLibrary } from '../documents/HospitalLibrary'
import { PrintingQrPanel } from './panels/PrintingQrPanel'
import { UserAccessCenterPanel } from './panels/UserAccessCenterPanel'
import { RolesPermissionsPanel } from './panels/RolesPermissionsPanel'
import { SecurityCompliancePanel } from './panels/SecurityCompliancePanel'
import { BackupRestorePanel } from './panels/BackupRestorePanel'
import { AuditLogPanel } from './panels/AuditLogPanel'

export type ControlCenterSection =
  | 'home'
  | 'organization'
  | 'facilities'
  | 'users'
  | 'roles'
  | 'departments'
  | 'clinical'
  | 'wards'
  | 'laboratory'
  | 'radiology'
  | 'theatre'
  | 'maternity'
  | 'templates'
  | 'hospital-docs'
  | 'printing'
  | 'branding'
  | 'notifications'
  | 'reporting'
  | 'audit'
  | 'security'
  | 'backup'
  | 'system'
  | 'superadmin'

export function HospitalControlCenter() {
  const [section, setSection] = useState<ControlCenterSection>('home')
  const activeCard = section === 'home' ? null : findControlCenterCard(section)

  const openSection = (next: ControlCenterSection) => setSection(next)
  const goHome = () => setSection('home')

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <PageHeader
        eyebrow="Administration"
        title="Hospital control center"
        description="The operational brain of AfyaSasa — configure, secure, brand, and operate the hospital without code changes."
      />

      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <button
          type="button"
          onClick={goHome}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-slate-100 hover:text-slate-800"
        >
          <Home className="h-4 w-4" />
          Home
        </button>
        {activeCard ? (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-400">{activeCard.category}</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-semibold text-slate-800">{activeCard.title}</span>
          </>
        ) : null}
      </nav>

      {section === 'home' ? (
        <ControlCenterHome onOpen={openSection} />
      ) : (
        <div className="space-y-4">
          {activeCard ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Help: </span>
              {activeCard.help}
            </div>
          ) : null}

          {section === 'organization' && <HospitalProfilePanel />}
          {section === 'facilities' && <FacilitiesModulesPanel />}
          {section === 'users' && <UserAccessCenterPanel />}
          {section === 'roles' && <RolesPermissionsPanel />}
          {section === 'departments' && <DepartmentsClinicsPanel />}
          {section === 'clinical' && <ClinicalConfigPanel />}
          {section === 'wards' && <WardManagementPanel />}
          {section === 'laboratory' && <LabCatalogPanel />}
          {section === 'radiology' && <RadiologyCatalogPanel />}
          {section === 'theatre' && <TheatreCatalogPanel />}
          {section === 'maternity' && <MaternityConfigPanel />}
          {section === 'templates' && <DocumentTemplatesPanel />}
          {section === 'hospital-docs' && <HospitalLibrary adminMode />}
          {section === 'printing' && <PrintingQrPanel />}
          {section === 'branding' && <BrandingPanel />}
          {section === 'notifications' && <NotificationsConfigPanel />}
          {section === 'reporting' && <ReportingCenterPanel />}
          {section === 'audit' && <AuditLogPanel />}
          {section === 'security' && <SecurityCompliancePanel />}
          {section === 'backup' && <BackupRestorePanel />}
          {section === 'system' && <SystemHealthPanel />}
          {section === 'superadmin' && <SuperAdminPanel />}
        </div>
      )}
    </div>
  )
}
