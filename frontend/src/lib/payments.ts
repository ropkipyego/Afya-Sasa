import { apiRequest } from './api'

export type PaymentServiceLine =
  | 'consultation'
  | 'pharmacy'
  | 'laboratory'
  | 'radiology'
  | 'inpatient'
  | 'other'

export const PAYMENT_SERVICE_LINES: Array<{ value: PaymentServiceLine; label: string }> = [
  { value: 'consultation', label: 'Consultation / OPD' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology / imaging' },
  { value: 'inpatient', label: 'Inpatient / IPD' },
  { value: 'other', label: 'Other service' },
]

export type PaymentTransactionRow = {
  id: string
  method: string
  status: string
  amount: string | null
  serviceLine?: PaymentServiceLine | null
  serviceDescription?: string | null
  externalReference?: string | null
  createdAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
}

export type CollectPaymentInput = {
  patientId: string
  serviceLine: PaymentServiceLine
  serviceEntityId?: string
  encounterId?: string
  serviceDescription: string
  amount: number
  paymentMethod: string
  payerScheme?: string
  mpesaPhone?: string
  paymentReference?: string
  chargeId?: string
}

export async function collectPayment(input: CollectPaymentInput) {
  if (input.paymentMethod === 'mpesa') {
    return apiRequest<{ transaction: PaymentTransactionRow; stk?: { message?: string; mock?: boolean } }>(
      '/payments/mpesa/stk-push',
      {
        method: 'POST',
        body: JSON.stringify({
          patientId: input.patientId,
          serviceLine: input.serviceLine,
          serviceEntityId: input.serviceEntityId,
          encounterId: input.encounterId,
          chargeId: input.chargeId,
          serviceDescription: input.serviceDescription,
          phone: input.mpesaPhone,
          amount: input.amount,
          description: input.serviceDescription,
        }),
      },
    )
  }

  return apiRequest<PaymentTransactionRow>('/payments/manual', {
    method: 'POST',
    body: JSON.stringify({
      patientId: input.patientId,
      serviceLine: input.serviceLine,
      serviceEntityId: input.serviceEntityId,
      encounterId: input.encounterId,
      chargeId: input.chargeId,
      serviceDescription: input.serviceDescription,
      method: input.paymentMethod,
      payerScheme: input.payerScheme,
      reference: input.paymentReference,
      amount: input.amount,
    }),
  })
}

export function listPatientPayments(patientId: string) {
  return apiRequest<PaymentTransactionRow[]>(`/payments/transactions?patientId=${patientId}&limit=20`)
}

export function listRecentPayments(limit = 200) {
  return apiRequest<PaymentTransactionRow[]>(`/payments/transactions?limit=${Math.min(limit, 200)}`)
}

export type OutstandingPharmacyBill = {
  serviceLine: PaymentServiceLine
  serviceEntityId: string
  chargeId?: string
  encounterId: string | null
  orderNo: string
  description: string
  dispensedAt: string | null
  amountOwed?: number
  amountPaid?: number
  remaining?: number
}

export function listOutstandingPharmacy(patientId: string) {
  return apiRequest<OutstandingPharmacyBill[]>(`/payments/outstanding?patientId=${patientId}`)
}

export type PatientChargeRow = {
  id: string
  serviceLine: PaymentServiceLine
  serviceDescription: string
  amountOwed: string
  amountPaid: string
  amountWaived?: string
  status: string
  createdAt: string
  encounter?: { id: string } | null
  metadata?: { admissionId?: string | null; payerScheme?: string | null } | null
}

export function listPatientCharges(patientId: string) {
  return apiRequest<PatientChargeRow[]>(`/payments/charges?patientId=${patientId}`)
}
