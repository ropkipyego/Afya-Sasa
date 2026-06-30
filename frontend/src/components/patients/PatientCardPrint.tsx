import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { normalizeClinicalCatalog } from '../../lib/clinical-catalog'

export type PatientCardData = {
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  bloodGroup?: string | null
  primaryPhone: string
  qrDataUrl: string
  qrCode: string
  nextOfKin?: { name: string; primaryPhone: string } | null
}

export function PatientCardPrint({ patient, qr }: { patient: PatientCardData; qr: { qrDataUrl: string; qrCode: string } }) {
  const { data: catalog } = useClinicalCatalog()
  const profile = normalizeClinicalCatalog(catalog).hospitalProfile ?? {}
  const emergency = patient.nextOfKin

  return (
    <div className="patient-card-print rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt="" className="mb-2 h-10 object-contain" />
          ) : null}
          <p className="text-lg font-bold" style={{ color: profile.primaryColor ?? '#0d9488' }}>
            {profile.facilityName ?? 'Hospital'}
          </p>
          {profile.tagline ? <p className="text-xs text-slate-500">{profile.tagline}</p> : null}
        </div>
        <img src={qr.qrDataUrl} alt="Patient QR" className="h-24 w-24 rounded-lg border border-slate-200" />
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="text-xl font-bold text-slate-900">
          {patient.firstName} {patient.lastName}
        </p>
        <Row label="MRN" value={patient.patientNo} />
        <Row label="Date of birth" value={patient.dateOfBirth} />
        <Row label="Gender" value={patient.gender} />
        {patient.bloodGroup ? <Row label="Blood group" value={patient.bloodGroup} /> : null}
        <Row label="Phone" value={patient.primaryPhone} />
        {emergency ? (
          <Row label="Emergency contact" value={`${emergency.name} · ${emergency.primaryPhone}`} />
        ) : null}
      </div>

      <p className="mt-4 font-mono text-[10px] text-slate-400">{qr.qrCode}</p>
      {profile.footerText ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-500">{profile.footerText}</p>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}: </span>
      <span className="font-semibold text-slate-800">{value}</span>
    </p>
  )
}
