import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Droplets, Phone, ShieldAlert, User } from 'lucide-react'
import { Alert, Button } from '../ui'
import { PatientFileModal } from './PatientFileModal'
import { fetchPublicPatientScan } from '../../lib/public-api'
import { useAuthStore } from '../../lib/auth-store'

type ScanCard = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  bloodGroup?: string | null
  primaryPhone: string
  isDeceased?: boolean
  allergies: { allergen: string; severity: string }[]
  emergencyContact: { name: string; relationship: string; primaryPhone: string } | null
  hospital: {
    name: string
    address?: string | null
    logoUrl?: string | null
    primaryColor?: string | null
    tagline?: string | null
  }
}

export function PatientQrLanding({ code }: { code: string }) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [openFile, setOpenFile] = useState(false)
  const safeCode = decodeURIComponent(code ?? '').trim()
  const invalidCode = !safeCode || ['null', 'undefined', 'nan'].includes(safeCode.toLowerCase())
  const { data: card, isLoading, error } = useQuery({
    queryKey: ['patient-scan-card', safeCode],
    queryFn: () => fetchPublicPatientScan<ScanCard>(safeCode),
    enabled: !invalidCode,
  })
  const color = card?.hospital.primaryColor || '#0d9488'

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        {invalidCode ? (
          <Alert tone="error">
            This QR code is incomplete. Ask reception to reprint the patient card — do not scan a
            localhost or empty code.
          </Alert>
        ) : null}
        {isLoading ? <p className="text-center text-sm text-slate-500">Looking up patient card…</p> : null}
        {error ? (
          <Alert tone="error">
            This QR code is not a recognised patient card. Ask reception to reprint the card.
          </Alert>
        ) : null}
        {card ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="px-5 py-5 text-white" style={{ background: color }}>
              {card.hospital.logoUrl ? (
                <img src={card.hospital.logoUrl} alt="" className="mb-3 h-10 object-contain" />
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Patient identification
              </p>
              <h1 className="mt-1 text-xl font-bold">{card.hospital.name}</h1>
              {card.hospital.tagline ? (
                <p className="mt-1 text-sm text-white/80">{card.hospital.tagline}</p>
              ) : null}
            </div>

            <div className="space-y-5 px-5 py-6">
              {card.isDeceased ? (
                <Alert tone="warning">This record is marked deceased. Confirm identity at records.</Alert>
              ) : null}
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {card.firstName} {card.lastName}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-600">{card.patientNo}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Date of birth" value={card.dateOfBirth} />
                <Fact label="Gender" value={card.gender} />
                <Fact
                  label="Blood group"
                  value={card.bloodGroup || 'Not recorded'}
                  icon={<Droplets className="h-3.5 w-3.5" />}
                  emphasize={Boolean(card.bloodGroup)}
                />
                <Fact label="Phone" value={card.primaryPhone} icon={<Phone className="h-3.5 w-3.5" />} />
              </dl>

              <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-800">
                  <ShieldAlert className="h-4 w-4" />
                  Allergies
                </p>
                {card.allergies.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-red-950">
                    {card.allergies.map((row) => (
                      <li key={row.allergen}>
                        <strong>{row.allergen}</strong> · {row.severity}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-red-900">No known allergies recorded.</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <User className="h-4 w-4" />
                  Emergency contact
                </p>
                {card.emergencyContact ? (
                  <p className="mt-2 text-sm text-slate-800">
                    {card.emergencyContact.name} ({card.emergencyContact.relationship})
                    <br />
                    {card.emergencyContact.primaryPhone}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">None recorded</p>
                )}
              </section>

              <p className="flex items-start gap-2 text-xs text-slate-500">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This card identifies the patient for reception, triage, and emergency use. Visits,
                diagnoses, lab results, and payments stay inside the hospital system.
              </p>

              {accessToken ? (
                <Button type="button" className="w-full" onClick={() => setOpenFile(true)}>
                  Open full patient file
                </Button>
              ) : (
                <a
                  href="/"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  Staff sign in to open the full file
                </a>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {openFile && card ? (
        <PatientFileModal patientId={card.id} onClose={() => setOpenFile(false)} />
      ) : null}
    </div>
  )
}

function Fact({
  label,
  value,
  icon,
  emphasize,
}: {
  label: string
  value: string
  icon?: ReactNode
  emphasize?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 flex items-center gap-1 font-semibold ${emphasize ? 'text-red-700' : 'text-slate-900'}`}>
        {icon}
        {value}
      </dd>
    </div>
  )
}
