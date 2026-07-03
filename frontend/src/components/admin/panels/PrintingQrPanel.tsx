import { Card, PageHeader } from '../../ui'
import { CONFIG_DEPENDENCY_HINTS } from '../../../lib/hospital-configuration'

export function PrintingQrPanel() {
  return (
    <Card className="p-8">
      <PageHeader
        title="Printing & QR"
        description="Patient cards and QR lookup use hospital branding from the profile and branding panels."
      />
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <p>
          <strong>Patient cards</strong> — generated from registration and patient profile drawers. Logo, facility
          name, and footer text come from the hospital profile.
        </p>
        <p>
          <strong>QR codes</strong> — encode the patient lookup code for reception and ward workflows. Scanning routes
          to the patient record via <code className="rounded bg-slate-100 px-1">GET /patients/qr/:code</code>.
        </p>
        <p>
          <strong>Print templates</strong> — sick sheets, referrals, and certificates use the document template center.
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold">Branding dependency</p>
          <p className="mt-1">{CONFIG_DEPENDENCY_HINTS.hospitalProfile.join(' · ')}.</p>
        </div>
      </div>
    </Card>
  )
}
