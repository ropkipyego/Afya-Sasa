import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Smartphone, Wallet } from 'lucide-react'
import { Alert, Button, Field, SelectField } from '../ui'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { normalizeClinicalCatalog } from '../../lib/clinical-catalog'
import { collectPayment, type PaymentServiceLine, type PaymentTransactionRow } from '../../lib/payments'
import { formatApiError } from '../../lib/api'
import { notify } from '../../lib/notify'
import { resolveHospitalBranding } from '../../lib/hospital-configuration'
import { printPaymentReceipt } from '../../lib/print-payment-receipt'

export type PaymentCheckoutPanelProps = {
  patientId: string
  patientPhone?: string | null
  serviceLine: PaymentServiceLine
  serviceEntityId?: string
  encounterId?: string
  serviceDescription: string
  defaultAmount?: string
  submitLabel?: string
  receiptPatient?: { name: string; patientNo: string }
  onSuccess?: (result: { method: string; message?: string }) => void
}

export function PaymentCheckoutPanel({
  patientId,
  patientPhone,
  serviceLine,
  serviceEntityId,
  encounterId,
  serviceDescription,
  defaultAmount = '',
  submitLabel,
  receiptPatient,
  onSuccess,
}: PaymentCheckoutPanelProps) {
  const { data: rawCatalog } = useClinicalCatalog()
  const catalog = normalizeClinicalCatalog(rawCatalog)
  const brand = resolveHospitalBranding(catalog)

  const [amount, setAmount] = useState(defaultAmount)
  const [paymentMethod, setPaymentMethod] = useState('cash')

  useEffect(() => {
    setAmount(defaultAmount)
  }, [defaultAmount])
  const [payerScheme, setPayerScheme] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState(patientPhone ?? '')
  const [paymentReference, setPaymentReference] = useState('')
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const pay = useMutation({
    mutationFn: async () => {
      const parsedAmount = Number(amount)
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        throw new Error('Amount cannot be negative.')
      }
      if (paymentMethod !== 'waived' && parsedAmount <= 0) {
        throw new Error('Enter a valid amount in KES.')
      }
      if (paymentMethod === 'insurance' && !payerScheme) {
        throw new Error('Select an insurance scheme.')
      }
      if (paymentMethod === 'mpesa' && !mpesaPhone.trim()) {
        throw new Error('Enter the M-Pesa phone number for STK push.')
      }
      return collectPayment({
        patientId,
        serviceLine,
        serviceEntityId,
        encounterId,
        serviceDescription,
        amount: parsedAmount,
        paymentMethod,
        payerScheme: payerScheme || undefined,
        mpesaPhone: mpesaPhone || undefined,
        paymentReference: paymentReference || undefined,
      })
    },
    onSuccess: (response) => {
      const txn: PaymentTransactionRow | undefined =
        response && typeof response === 'object' && 'transaction' in response
          ? response.transaction
          : (response as PaymentTransactionRow)
      const stkMessage =
        'stk' in response && response.stk?.message ? response.stk.message : undefined
      const message =
        stkMessage ??
        (paymentMethod === 'insurance'
          ? 'Payment recorded as insurance pending.'
          : 'Payment recorded successfully.')
      setResultMessage(message)
      notify('Payment recorded', message, 'success')
      if (receiptPatient && txn) {
        printPaymentReceipt({
          facilityName: brand.facilityName,
          address: brand.physicalAddress ?? brand.address,
          phone: brand.contactPhone,
          patientName: receiptPatient.name,
          patientNo: receiptPatient.patientNo,
          service: serviceDescription,
          amount: txn.amount ?? amount,
          method: paymentMethod,
          status: txn.status,
          reference: txn.externalReference ?? paymentReference,
          paidAt: txn.createdAt ?? new Date().toISOString(),
        })
      }
      onSuccess?.({ method: paymentMethod, message })
    },
    onError: (error: Error) =>
      notify('Payment failed', formatApiError(error, 'Unable to record the payment.'), 'critical'),
  })

  const showInsurance = paymentMethod === 'insurance'
  const showMpesa = paymentMethod === 'mpesa'
  const showReference = ['cash', 'card', 'quickbooks'].includes(paymentMethod)

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Wallet className="h-4 w-4 text-teal-600" />
        Payment — {serviceDescription}
      </div>

      <Field
        name="billingAmount"
        label="Amount (KES)"
        type="number"
        min={0}
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <SelectField
        name="paymentMethod"
        label="Payment method"
        required
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
      >
        {catalog.paymentMethods.map((method) => (
          <option key={method.value} value={method.value}>
            {method.label}
          </option>
        ))}
      </SelectField>

      {showInsurance ? (
        <SelectField
          name="payerScheme"
          label="Insurance scheme"
          required
          value={payerScheme}
          onChange={(e) => setPayerScheme(e.target.value)}
        >
          <option value="">Select scheme…</option>
          {(catalog.insuranceSchemes ?? []).map((scheme) => (
            <option key={scheme.value} value={scheme.value}>
              {scheme.label}
            </option>
          ))}
        </SelectField>
      ) : null}

      {showMpesa ? (
        <Field
          name="mpesaPhone"
          label="M-Pesa phone (STK push)"
          required
          value={mpesaPhone}
          onChange={(e) => setMpesaPhone(e.target.value)}
          placeholder="07XX XXX XXX"
          hint="Patient receives a prompt on their phone to enter PIN."
        />
      ) : null}

      {showReference ? (
        <Field
          name="paymentReference"
          label="Receipt / reference"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder={
            paymentMethod === 'quickbooks' ? 'QuickBooks receipt #' : 'Cash receipt or card auth'
          }
        />
      ) : null}

      {resultMessage ? <Alert tone="success">{resultMessage}</Alert> : null}
      {pay.error ? (
        <Alert tone="error">{formatApiError(pay.error, 'Unable to record the payment.')}</Alert>
      ) : null}

      <Button
        type="button"
        loading={pay.isPending}
        disabled={pay.isPending}
        onClick={() => {
          if (pay.isPending) return
          pay.mutate()
        }}
        className="w-full"
      >
        {showMpesa ? (
          <>
            <Smartphone className="h-4 w-4" />
            {submitLabel ?? 'Send M-Pesa STK push'}
          </>
        ) : (
          submitLabel ?? 'Record payment'
        )}
      </Button>
    </div>
  )
}
