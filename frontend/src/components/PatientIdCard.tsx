import { Printer } from 'lucide-react'
import { Button } from './ui'

export type PatientIdCardData = {
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  gender?: string
  primaryPhone?: string
  bloodGroup?: string | null
  county?: string | null
  qrDataUrl?: string
  qrCode?: string
  hospitalName?: string
}

export function PatientIdCard({
  patient,
  compact = false,
}: {
  patient: PatientIdCardData
  compact?: boolean
}) {
  const fullName = `${patient.firstName} ${patient.lastName}`.trim()
  const hospital = patient.hospitalName ?? 'AfyaSasa Hospital'

  return (
    <div
      className={`patient-id-card overflow-hidden rounded-2xl border-2 border-teal-800/20 bg-gradient-to-br from-white via-teal-50/30 to-slate-50 shadow-lg ${
        compact ? 'max-w-sm' : 'max-w-md'
      }`}
    >
      <div className="border-b border-teal-900/10 bg-gradient-to-r from-teal-900 to-teal-700 px-5 py-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100">
          Patient identification
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight">{hospital}</h3>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Full name
            </p>
            <p className="text-xl font-bold text-slate-900">{fullName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Patient number
            </p>
            <p className="font-mono text-2xl font-bold tracking-wide text-teal-800">
              {patient.patientNo}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {patient.dateOfBirth ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">DOB</p>
                <p className="font-semibold text-slate-800">{patient.dateOfBirth}</p>
              </div>
            ) : null}
            {patient.gender ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Gender</p>
                <p className="font-semibold capitalize text-slate-800">{patient.gender}</p>
              </div>
            ) : null}
            {patient.bloodGroup ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Blood group</p>
                <p className="font-semibold text-slate-800">{patient.bloodGroup}</p>
              </div>
            ) : null}
            {patient.primaryPhone ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Phone</p>
                <p className="font-semibold text-slate-800">{patient.primaryPhone}</p>
              </div>
            ) : null}
          </div>
        </div>

        {patient.qrDataUrl ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
            <img
              src={patient.qrDataUrl}
              alt={`QR code for ${patient.patientNo}`}
              className="h-28 w-28"
            />
            <p className="mt-2 text-center text-[9px] font-medium leading-tight text-slate-500">
              Scan with any phone camera to open patient file
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-3">
        <p className="text-[10px] text-slate-500">
          QR is recommended over barcode — any smartphone can scan it to open this patient&apos;s
          hospital record instantly.
        </p>
        {patient.qrCode ? (
          <p className="mt-1 truncate font-mono text-[9px] text-slate-400">{patient.qrCode}</p>
        ) : null}
      </div>
    </div>
  )
}

export function PatientIdCardActions({
  onPrint,
  className,
}: {
  onPrint: () => void
  className?: string
}) {
  return (
    <div className={`no-print flex flex-wrap gap-2 ${className ?? ''}`}>
      <Button type="button" onClick={onPrint}>
        <Printer className="h-4 w-4" />
        Print patient ID card
      </Button>
    </div>
  )
}
