import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, History } from 'lucide-react'
import {
  Card,
  Field,
  PageHeader,
  SelectField,
} from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { PatientContextHeader } from '../PatientContextHeader'
import { PaymentCheckoutPanel } from './PaymentCheckoutPanel'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { clinicConsultationFee, formatKes } from '../../lib/clinical-catalog'
import {
  listPatientPayments,
  PAYMENT_SERVICE_LINES,
  type PaymentServiceLine,
} from '../../lib/payments'
import { ShaEligibilityCard } from '../sha/ShaEligibilityCard'

export function PaymentDesk() {
  const { data: catalog } = useClinicalCatalog()
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [serviceLine, setServiceLine] = useState<PaymentServiceLine>('consultation')
  const [clinicName, setClinicName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [amount, setAmount] = useState('')
  const mappedFee = clinicConsultationFee(catalog, clinicName)
  const clinics = catalog?.clinics ?? []

  const { data: recentPayments = [], refetch } = useQuery({
    queryKey: ['patient-payments', patient?.id],
    queryFn: () => listPatientPayments(patient!.id),
    enabled: Boolean(patient?.id),
  })

  useEffect(() => {
    if (serviceLine !== 'consultation' || !clinicName) return
    if (mappedFee > 0) setAmount(String(mappedFee))
    setServiceDescription(`${clinicName} consultation`)
  }, [clinicName, mappedFee, serviceLine])

  const descriptionPlaceholder =
    serviceLine === 'consultation'
      ? 'e.g. General OPD consultation'
      : serviceLine === 'pharmacy'
        ? 'e.g. Dispensed prescriptions'
        : serviceLine === 'laboratory'
          ? 'e.g. FBC, LFT panel'
          : serviceLine === 'radiology'
            ? 'e.g. Chest X-ray PA view'
            : 'Describe the service being paid for'

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <Card className="card-hover p-5 md:p-8">
        <PageHeader
          eyebrow="Finance"
          title="Payments & cashier"
          description="Collect payment for any hospital service — consultation, pharmacy, laboratory, radiology, or other — via M-Pesa STK push, cash, card, insurance, or QuickBooks."
        />

        <div className="mt-8 space-y-6">
          <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
          {patient ? (
            <>
              <PatientContextHeader patient={patient} workflowStep="checked_in" />
              <ShaEligibilityCard patientId={patient.id} />
            </>
          ) : null}

          {patient ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  name="serviceLine"
                  label="Service type"
                  required
                  value={serviceLine}
                  onChange={(e) => {
                    setServiceLine(e.target.value as PaymentServiceLine)
                    if (e.target.value !== 'consultation') setClinicName('')
                  }}
                >
                  {PAYMENT_SERVICE_LINES.map((line) => (
                    <option key={line.value} value={line.value}>
                      {line.label}
                    </option>
                  ))}
                </SelectField>
                {serviceLine === 'consultation' ? (
                  <SelectField
                    name="clinicName"
                    label="Clinic"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                  >
                    <option value="">Select clinic…</option>
                    {clinics.map((clinic) => (
                      <option key={clinic} value={clinic}>
                        {clinic} — {formatKes(clinicConsultationFee(catalog, clinic))}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <Field
                    name="amountPreview"
                    label="Amount (KES)"
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Fee total"
                  />
                )}
              </div>
              {serviceLine === 'consultation' && clinicName ? (
                <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                  Mapped consultation fee for <strong>{clinicName}</strong> is{' '}
                  <strong>{formatKes(mappedFee)}</strong>. This amount is filled automatically.
                </p>
              ) : null}
              {serviceLine === 'consultation' ? (
                <Field
                  name="amountPreview"
                  label="Amount (KES)"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Clinic fee"
                  hint="Filled from the clinic mapping. Change only if a supervisor authorised a different amount."
                />
              ) : null}

              <Field
                name="serviceDescription"
                label="Service description"
                required
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder={descriptionPlaceholder}
              />

              <PaymentCheckoutPanel
                patientId={patient.id}
                patientPhone={patient.primaryPhone}
                serviceLine={serviceLine}
                serviceDescription={
                  serviceDescription ||
                  (PAYMENT_SERVICE_LINES.find((l) => l.value === serviceLine)?.label ?? 'Hospital service')
                }
                defaultAmount={amount}
                submitLabel="Collect payment"
                onSuccess={async () => {
                  await refetch()
                  setAmount('')
                  setServiceDescription('')
                  setClinicName('')
                }}
              />
            </>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Search for a patient to collect payment. STK push works for consultation fees, pharmacy
              sales, lab tests, radiology studies, and any other billable service.
            </p>
          )}
        </div>
      </Card>

      {patient && recentPayments.length ? (
        <Card className="p-5 md:p-8">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <History className="h-4 w-4 text-teal-600" />
            Recent payments — {patient.firstName} {patient.lastName}
          </div>
          <ul className="space-y-2">
            {recentPayments.map((txn) => (
              <li
                key={txn.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {txn.serviceDescription ?? txn.serviceLine ?? 'Payment'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {txn.method.toUpperCase()} · {txn.status} ·{' '}
                    {new Date(txn.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="font-bold text-teal-800">
                  {txn.amount ? `KES ${Number(txn.amount).toLocaleString()}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="border-dashed p-5 md:p-6">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <p>
            M-Pesa STK prompts, insurance schemes (SHA, Jubilee, etc.), and QuickBooks Desktop sync
            all flow through this module. Service-specific screens (OPD, lab, radiology, pharmacy)
            use the same payment engine when collecting fees at point of service.
          </p>
        </div>
      </Card>
    </div>
  )
}
