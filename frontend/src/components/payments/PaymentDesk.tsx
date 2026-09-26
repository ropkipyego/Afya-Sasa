import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, History, Printer } from 'lucide-react'
import {
  Button,
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
  listOutstandingPharmacy,
  listPatientCharges,
  listPatientPayments,
  PAYMENT_SERVICE_LINES,
  type PaymentServiceLine,
  type PaymentTransactionRow,
} from '../../lib/payments'
import { useAuthStore } from '../../lib/auth-store'
import { notify } from '../../lib/notify'
import { ShaEligibilityCard } from '../sha/ShaEligibilityCard'
import { resolveHospitalBranding } from '../../lib/hospital-configuration'
import { printPaymentReceipt } from '../../lib/print-payment-receipt'
import { apiRequest, formatApiError } from '../../lib/api'

export function PaymentDesk() {
  const { data: catalog } = useClinicalCatalog()
  const brand = resolveHospitalBranding(catalog)
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [serviceLine, setServiceLine] = useState<PaymentServiceLine>('consultation')
  const [clinicName, setClinicName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [stockItemId, setStockItemId] = useState('')
  const [stockQty, setStockQty] = useState('1')
  const [pharmacyCart, setPharmacyCart] = useState<Array<{ itemId: string; qty: string }>>([])
  const [catalogService, setCatalogService] = useState('')
  const [labTestIds, setLabTestIds] = useState<string[]>([])
  const [labQuery, setLabQuery] = useState('')
  const [pharmacyOrderId, setPharmacyOrderId] = useState('')
  const [selectedChargeId, setSelectedChargeId] = useState('')
  const queryClient = useQueryClient()
  const canCloseCashier = useAuthStore((state) => (state.user?.permissions ?? []).includes('payments:manage'))

  const { data: stockItems = [] } = useQuery({
    queryKey: ['inventory-items', 'cashier'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: string
          sku: string
          name: string
          unit: string
          sell?: number
          drugClass?: string
        }>
      >('/inventory/items'),
    enabled: serviceLine === 'pharmacy',
  })

  const { data: labTests = [] } = useQuery({
    queryKey: ['lab-catalog-tests', 'cashier'],
    queryFn: () =>
      apiRequest<Array<{ id: string; name: string; code: string; isPanel?: boolean; sell?: number }>>(
        '/laboratory/catalog/tests',
      ),
    enabled: serviceLine === 'laboratory',
    retry: false,
  })

  const { data: radStudies = [] } = useQuery({
    queryKey: ['radiology-studies', 'cashier'],
    queryFn: () =>
      apiRequest<Array<{ code: string; name: string }>>('/radiology/studies'),
    enabled: serviceLine === 'radiology',
    retry: false,
  })

  const { data: theatreProcedures = [] } = useQuery({
    queryKey: ['theatre-procedures', 'cashier'],
    queryFn: () =>
      apiRequest<Array<{ id: string; name: string; code: string }>>('/theatre/procedures'),
    enabled: serviceLine === 'other',
    retry: false,
  })
  const mappedFee = clinicConsultationFee(catalog, clinicName)
  const clinics = catalog?.clinics ?? []

  const { data: recentPayments = [], refetch } = useQuery({
    queryKey: ['patient-payments', patient?.id],
    queryFn: () => listPatientPayments(patient!.id),
    enabled: Boolean(patient?.id),
  })

  const { data: outstandingPharmacy = [], refetch: refetchOutstanding } = useQuery({
    queryKey: ['pharmacy-outstanding', patient?.id],
    queryFn: () => listOutstandingPharmacy(patient!.id),
    enabled: Boolean(patient?.id),
  })

  const { data: patientCharges = [], refetch: refetchCharges } = useQuery({
    queryKey: ['patient-charges', patient?.id],
    queryFn: () => listPatientCharges(patient!.id),
    enabled: Boolean(patient?.id),
  })

  const chargeTotals = useMemo(() => {
    const charges = patientCharges.reduce((sum, row) => sum + Number(row.amountOwed), 0)
    const paid = patientCharges.reduce((sum, row) => sum + Number(row.amountPaid), 0)
    const waived = patientCharges.reduce((sum, row) => sum + Number(row.amountWaived ?? 0), 0)
    return { charges, paid, outstanding: Math.max(0, charges - paid - waived) }
  }, [patientCharges])

  const selectedCharge = patientCharges.find((row) => row.id === selectedChargeId)

  const closeCashier = useMutation({
    mutationFn: () =>
      apiRequest<{ lastClosedAt: string; count: number; totals: Record<string, number> }>(
        '/payments/cashier/close',
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      notify(
        'Cash point closed',
        `${result.count} completed payments recorded for this close.`,
        'success',
      )
      void queryClient.invalidateQueries({ queryKey: ['patient-payments'] })
    },
    onError: (error: Error) =>
      notify('Could not close cash point', formatApiError(error, 'Cashier close failed.'), 'critical'),
  })

  useEffect(() => {
    if (serviceLine !== 'consultation' || !clinicName) return
    if (mappedFee > 0) setAmount(String(mappedFee))
    setServiceDescription(`${clinicName} consultation`)
  }, [clinicName, mappedFee, serviceLine])

  useEffect(() => {
    if (serviceLine !== 'pharmacy' || pharmacyOrderId) return
    const lines = pharmacyCart
      .map((line) => {
        const item = stockItems.find((row) => row.id === line.itemId)
        const qty = Number(line.qty)
        if (!item || !Number.isFinite(qty) || qty <= 0) return null
        return { item, qty }
      })
      .filter((row): row is { item: (typeof stockItems)[number]; qty: number } => Boolean(row))
    if (!lines.length) return
    const total = lines.reduce((sum, row) => sum + Number(row.item.sell ?? 0) * row.qty, 0)
    setAmount(String(Math.round(total * 100) / 100))
    setServiceDescription(
      lines.map((row) => `${row.item.name} × ${row.qty} ${row.item.unit}`).join(', '),
    )
  }, [serviceLine, pharmacyCart, pharmacyOrderId, stockItems])

  useEffect(() => {
    if (serviceLine !== 'laboratory') return
    const selected = labTests.filter((row) => labTestIds.includes(row.id))
    if (!selected.length) return
    const total = selected.reduce((sum, row) => sum + Number(row.sell ?? 0), 0)
    if (total > 0) setAmount(String(Math.round(total * 100) / 100))
    setServiceDescription(selected.map((row) => row.name).join(', '))
  }, [serviceLine, labTestIds, labTests])

  useEffect(() => {
    if (!catalogService) return
    if (serviceLine === 'laboratory') return
    if (serviceLine === 'radiology') {
      const study = radStudies.find((row) => row.code === catalogService)
      if (study) setServiceDescription(study.name)
    }
    if (serviceLine === 'other') {
      const procedure = theatreProcedures.find((row) => row.id === catalogService)
      if (procedure) setServiceDescription(procedure.name)
    }
  }, [catalogService, serviceLine, labTests, radStudies, theatreProcedures])

  const printReceipt = (txn: PaymentTransactionRow) => {
    if (!patient) return
    printPaymentReceipt({
      facilityName: brand.facilityName,
      address: brand.physicalAddress ?? brand.address,
      phone: brand.contactPhone,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientNo: patient.patientNo,
      service: txn.serviceDescription ?? txn.serviceLine ?? 'Hospital service',
      amount: txn.amount ?? 0,
      method: txn.method,
      status: txn.status,
      reference: txn.externalReference,
      paidAt: txn.createdAt,
    })
  }

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
          title="Cashier"
          description="Collect payment against an existing charge or a confirmed service. A payment settles the account — it does not replace the charge."
          actions={
            canCloseCashier ? (
              <Button type="button" variant="secondary" loading={closeCashier.isPending} onClick={() => closeCashier.mutate()}>
                Close cash point
              </Button>
            ) : undefined
          }
        />

        <div className="mt-8 space-y-6">
          <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
          {patient ? (
            <>
              <PatientContextHeader patient={patient} workflowStep="checked_in" />
              <ShaEligibilityCard patientId={patient.id} />
              {patientCharges.length ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Charges</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{formatKes(chargeTotals.charges)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Paid</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{formatKes(chargeTotals.paid)}</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Outstanding</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{formatKes(chargeTotals.outstanding)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Charge</th>
                          <th className="px-3 py-2">Encounter</th>
                          <th className="px-3 py-2 text-right">Owed</th>
                          <th className="px-3 py-2 text-right">Paid</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="px-3 py-2">Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientCharges.map((row) => {
                          const remaining = Math.max(
                            0,
                            Number(row.amountOwed) - Number(row.amountPaid) - Number(row.amountWaived ?? 0),
                          )
                          return (
                            <tr key={row.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">
                                <p className="font-medium">{row.serviceDescription}</p>
                                <p className="text-xs text-slate-500">
                                  {row.serviceLine} · {row.status.replace('_', ' ')}
                                  {row.metadata?.payerScheme ? ` · ${row.metadata.payerScheme}` : ''}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {row.encounter?.id ? 'Linked encounter' : row.metadata?.admissionId ? 'Admission' : '—'}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatKes(Number(row.amountOwed))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatKes(Number(row.amountPaid))}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatKes(remaining)}</td>
                              <td className="px-3 py-2">
                                {remaining > 0 ? (
                                  <Button
                                    type="button"
                                    variant={selectedChargeId === row.id ? 'primary' : 'secondary'}
                                    className="px-3 py-1 text-xs"
                                    onClick={() => {
                                      setSelectedChargeId(row.id)
                                      setServiceLine(row.serviceLine)
                                      setServiceDescription(row.serviceDescription)
                                      setAmount(String(remaining))
                                    }}
                                  >
                                    {selectedChargeId === row.id ? 'Selected' : 'Pay'}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400">Settled</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
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
                    if (e.target.value !== 'pharmacy') {
                      setStockItemId('')
                      setStockQty('1')
                      setPharmacyOrderId('')
                      setPharmacyCart([])
                    }
                    if (e.target.value !== 'laboratory') {
                      setLabTestIds([])
                      setLabQuery('')
                    }
                    setCatalogService('')
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
              {serviceLine === 'laboratory' ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Laboratory tests
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {labTests.length} catalog tests · tick every test on the bill
                    </span>
                  </label>
                  <input
                    className="input"
                    placeholder="Search FBC, malaria, LFT…"
                    value={labQuery}
                    onChange={(e) => setLabQuery(e.target.value)}
                  />
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    {labTests
                      .filter((test) => {
                        const q = labQuery.trim().toLowerCase()
                        if (!q) return true
                        return (
                          test.name.toLowerCase().includes(q) ||
                          (test.code ?? '').toLowerCase().includes(q)
                        )
                      })
                      .map((test) => {
                        const checked = labTestIds.includes(test.id)
                        return (
                          <label
                            key={test.id}
                            className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-teal-600"
                              checked={checked}
                              onChange={() =>
                                setLabTestIds((current) =>
                                  current.includes(test.id)
                                    ? current.filter((id) => id !== test.id)
                                    : [...current, test.id],
                                )
                              }
                            />
                            <span className="font-medium text-slate-800">
                              {test.isPanel ? `${test.name} (panel)` : test.name}
                            </span>
                            <span className="ml-auto text-xs font-semibold text-teal-800">
                              {Number(test.sell ?? 0) > 0 ? formatKes(test.sell) : 'No price configured'}
                            </span>
                          </label>
                        )
                      })}
                  </div>
                  <p className="text-xs text-slate-500">
                    Amount is the exact sum of the selected catalog prices. Set missing prices in
                    Admin → Laboratory catalog.
                  </p>
                </div>
              ) : null}
              {serviceLine === 'radiology' ? (
                <SelectField
                  name="radStudy"
                  label="Imaging study"
                  value={catalogService}
                  onChange={(e) => setCatalogService(e.target.value)}
                  hint="From the radiology catalog import."
                >
                  <option value="">Select study…</option>
                  {radStudies.map((study) => (
                    <option key={study.code} value={study.code}>
                      {study.name}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              {serviceLine === 'other' ? (
                <SelectField
                  name="theatreProcedure"
                  label="Listed service / procedure"
                  value={catalogService}
                  onChange={(e) => setCatalogService(e.target.value)}
                  hint="Theatre procedures from the catalog import."
                >
                  <option value="">Select procedure…</option>
                  {theatreProcedures.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              {serviceLine === 'pharmacy' &&
              outstandingPharmacy.filter((row) => row.serviceLine === 'pharmacy').length ? (
                <SelectField
                  name="pharmacyOrderId"
                  label="Unpaid dispensed prescription"
                  value={pharmacyOrderId}
                  onChange={(e) => {
                    const selected = outstandingPharmacy
                      .filter((row) => row.serviceLine === 'pharmacy')
                      .find((row) => row.serviceEntityId === e.target.value)
                    setPharmacyOrderId(e.target.value)
                    if (selected) {
                      setServiceDescription(selected.description)
                      if (selected.remaining != null) setAmount(String(selected.remaining))
                    }
                  }}
                  hint="Dispense already happened. Pay this prescription (full or partial) so cashier and pharmacy stay on the same bill."
                >
                  <option value="">Select dispensed order…</option>
                  {outstandingPharmacy
                    .filter((row) => row.serviceLine === 'pharmacy')
                    .map((row) => (
                    <option key={row.serviceEntityId} value={row.serviceEntityId}>
                      {row.orderNo} — {row.description}
                      {row.remaining != null ? ` · balance ${formatKes(row.remaining)}` : ''}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              {serviceLine === 'pharmacy' ? (
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <SelectField
                      name="stockItemId"
                      label="Stock item"
                      value={stockItemId}
                      onChange={(e) => setStockItemId(e.target.value)}
                      hint="Add as many drugs as were dispensed. Selling price comes from Inventory → Prices."
                    >
                      <option value="">Select priced item…</option>
                      {stockItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {formatKes(item.sell)} / {item.unit}
                        </option>
                      ))}
                    </SelectField>
                    <Field
                      name="stockQty"
                      label="Quantity"
                      type="number"
                      min={0.01}
                      step="any"
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!stockItemId}
                        onClick={() => {
                          if (!stockItemId) return
                          setPharmacyCart((current) => {
                            const existing = current.find((line) => line.itemId === stockItemId)
                            if (existing) {
                              const nextQty = Number(existing.qty) + Number(stockQty || 1)
                              return current.map((line) =>
                                line.itemId === stockItemId
                                  ? { ...line, qty: String(nextQty) }
                                  : line,
                              )
                            }
                            return [...current, { itemId: stockItemId, qty: stockQty || '1' }]
                          })
                          setStockItemId('')
                          setStockQty('1')
                        }}
                      >
                        Add drug
                      </Button>
                    </div>
                  </div>
                  {pharmacyCart.length ? (
                    <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      {pharmacyCart.map((line) => {
                        const item = stockItems.find((row) => row.id === line.itemId)
                        return (
                          <li key={line.itemId} className="flex items-center justify-between gap-3">
                            <span>
                              {item?.name ?? 'Item'} × {line.qty} {item?.unit ?? ''}
                              {item?.sell != null
                                ? ` · ${formatKes(Number(item.sell) * Number(line.qty || 0))}`
                                : ''}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              onClick={() =>
                                setPharmacyCart((current) =>
                                  current.filter((row) => row.itemId !== line.itemId),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Add every dispensed drug. The amount is the sum of each line.
                    </p>
                  )}
                </div>
              ) : null}
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
                serviceEntityId={
                  serviceLine === 'pharmacy' ? pharmacyOrderId || undefined : catalogService || undefined
                }
                chargeId={
                  selectedCharge?.id ??
                  (serviceLine === 'pharmacy'
                    ? outstandingPharmacy.find((row) => row.serviceEntityId === pharmacyOrderId)?.chargeId
                    : undefined)
                }
                encounterId={
                  selectedCharge?.encounter?.id ??
                  outstandingPharmacy.find((row) => row.serviceEntityId === pharmacyOrderId)?.encounterId ??
                  undefined
                }
                serviceDescription={
                  serviceDescription ||
                  (PAYMENT_SERVICE_LINES.find((l) => l.value === serviceLine)?.label ?? 'Hospital service')
                }
                defaultAmount={amount}
                submitLabel="Collect payment"
                receiptPatient={{
                  name: `${patient.firstName} ${patient.lastName}`,
                  patientNo: patient.patientNo,
                }}
                onSuccess={async () => {
                  await refetch()
                  await refetchOutstanding()
                  await refetchCharges()
                  setAmount('')
                  setServiceDescription('')
                  setClinicName('')
                  setPharmacyOrderId('')
                  setPharmacyCart([])
                  setLabTestIds([])
                  setLabQuery('')
                  setCatalogService('')
                  setSelectedChargeId('')
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
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-800">
                    {txn.amount ? `KES ${Number(txn.amount).toLocaleString()}` : '—'}
                  </span>
                  <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => printReceipt(txn)}>
                    <Printer className="h-3.5 w-3.5" />
                    Receipt
                  </Button>
                </div>
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
