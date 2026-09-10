import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Button } from '../ui'
import { formatKes } from '../../lib/clinical-catalog'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { resolveHospitalBranding } from '../../lib/hospital-configuration'
import { printPaymentReceipt } from '../../lib/print-payment-receipt'
import {
  listRecentPayments,
  PAYMENT_SERVICE_LINES,
  type PaymentServiceLine,
  type PaymentTransactionRow,
} from '../../lib/payments'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { LabSection, LabStatCard } from '../investigations/lab-ui'
import { CreditCard, Landmark, Wallet } from 'lucide-react'

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function isCollected(txn: PaymentTransactionRow) {
  return txn.status === 'completed' || txn.status === 'paid' || txn.status === 'success'
}

function lineLabel(line?: string | null) {
  return PAYMENT_SERVICE_LINES.find((row) => row.value === line)?.label ?? line ?? 'Other'
}

export function FinanceRevenuePanel() {
  const { data: catalog } = useClinicalCatalog()
  const brand = resolveHospitalBranding(catalog)
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['payment-transactions', 'revenue'],
    queryFn: () => listRecentPayments(200),
    refetchInterval: 30_000,
  })

  const collected = transactions.filter(isCollected)
  const todayStart = startOfToday().getTime()
  const today = collected.filter((txn) => new Date(txn.createdAt).getTime() >= todayStart)

  const todayTotal = today.reduce((sum, txn) => sum + Number(txn.amount ?? 0), 0)
  const loadedTotal = collected.reduce((sum, txn) => sum + Number(txn.amount ?? 0), 0)
  const insurancePending = transactions.filter((txn) => txn.status === 'insurance_pending' || txn.method === 'insurance')

  const byDepartment = useMemo(() => {
    const map = new Map<PaymentServiceLine | 'other', number>()
    for (const line of PAYMENT_SERVICE_LINES) map.set(line.value, 0)
    for (const txn of today) {
      const key = (txn.serviceLine ?? 'other') as PaymentServiceLine
      map.set(key, (map.get(key) ?? 0) + Number(txn.amount ?? 0))
    }
    return PAYMENT_SERVICE_LINES.map((line) => ({
      line: line.label,
      amount: map.get(line.value) ?? 0,
    })).filter((row) => row.amount > 0)
  }, [today])

  const byMethod = useMemo(() => {
    const map = new Map<string, number>()
    for (const txn of today) {
      const method = txn.method || 'other'
      map.set(method, (map.get(method) ?? 0) + Number(txn.amount ?? 0))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [today])

  const printTxn = (txn: PaymentTransactionRow) => {
    printPaymentReceipt({
      facilityName: brand.facilityName,
      address: brand.physicalAddress ?? brand.address,
      phone: brand.contactPhone,
      patientName: txn.patient
        ? `${txn.patient.firstName} ${txn.patient.lastName}`
        : 'Patient',
      patientNo: txn.patient?.patientNo ?? '—',
      service: txn.serviceDescription ?? lineLabel(txn.serviceLine),
      amount: txn.amount ?? 0,
      method: txn.method,
      status: txn.status,
      reference: txn.externalReference,
      paidAt: txn.createdAt,
    })
  }

  if (isLoading) {
    return <div className="h-48 animate-skeleton rounded-2xl" />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <LabStatCard
          label="Collected today"
          value={formatKes(todayTotal)}
          icon={Wallet}
          tone="border-teal-200 bg-gradient-to-br from-teal-50 to-white text-teal-950"
          hint={`${today.length} receipt${today.length === 1 ? '' : 's'}`}
        />
        <LabStatCard
          label="Loaded period"
          value={formatKes(loadedTotal)}
          icon={Landmark}
          tone="border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-950"
          hint={`${collected.length} completed of ${transactions.length} loaded`}
        />
        <LabStatCard
          label="Insurance / pending"
          value={insurancePending.length}
          icon={CreditCard}
          tone="border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          hint="Not treated as cash in hand"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabSection title="Today by department" description="From the payment service line on each receipt.">
          {byDepartment.length ? (
            <ul className="divide-y divide-slate-100">
              {byDepartment.map((row) => (
                <li key={row.line} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-slate-800">{row.line}</span>
                  <span className="tabular-nums font-semibold text-teal-900">{formatKes(row.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No completed payments today in the loaded set.</p>
          )}
        </LabSection>

        <LabSection title="Today by method" description="Cash, M-Pesa, card, insurance, and other recorded methods.">
          {byMethod.length ? (
            <ul className="divide-y divide-slate-100">
              {byMethod.map(([method, amount]) => (
                <li key={method} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium uppercase text-slate-800">{method}</span>
                  <span className="tabular-nums font-semibold text-teal-900">{formatKes(amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No completed payments today.</p>
          )}
        </LabSection>
      </div>

      <LabSection title="Recent receipts" description="Latest loaded transactions — reprint the simple slip.">
        {transactions.length ? (
          <ul className="space-y-2">
            {transactions.slice(0, 25).map((txn) => (
              <li
                key={txn.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {txn.patient
                      ? `${txn.patient.firstName} ${txn.patient.lastName}`
                      : 'Patient'}
                    {txn.patient?.patientNo ? (
                      <span className="ml-2 font-normal text-slate-500">
                        {formatPatientNoShort(txn.patient.patientNo)}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lineLabel(txn.serviceLine)} · {txn.method.toUpperCase()} · {txn.status} ·{' '}
                    {new Date(txn.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-800">{formatKes(txn.amount)}</span>
                  <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => printTxn(txn)}>
                    <Printer className="h-3.5 w-3.5" />
                    Receipt
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">No payment records loaded.</p>
        )}
      </LabSection>
    </div>
  )
}
