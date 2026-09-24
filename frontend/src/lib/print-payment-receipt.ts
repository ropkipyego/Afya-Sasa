import { formatKes } from './clinical-catalog'
import { buildSimplePdfBlob, downloadPdfBlob } from './simple-pdf'

export type PaymentReceiptData = {
  facilityName: string
  address?: string | null
  phone?: string | null
  patientName: string
  patientNo: string
  service: string
  amount: string | number
  method: string
  status?: string
  reference?: string | null
  paidAt: string
  queueToken?: string | null
}

export function printPaymentReceipt(data: PaymentReceiptData) {
  const amount =
    typeof data.amount === 'number' || data.amount
      ? formatKes(Number(data.amount))
      : '—'
  const blob = buildSimplePdfBlob('Official receipt', [
    data.facilityName,
    data.address ?? '',
    data.phone ?? '',
    `Date ${new Date(data.paidAt).toLocaleString()}`,
    `Patient ${data.patientName}`,
    `No. ${data.patientNo}`,
    data.queueToken ? `Queue ${data.queueToken}` : '',
    `Service ${data.service}`,
    `Method ${data.method}`,
    data.reference ? `Ref ${data.reference}` : '',
    data.status ? `Status ${data.status}` : '',
    `Paid ${amount}`,
  ].filter(Boolean))
  downloadPdfBlob(blob, `receipt-${data.patientNo}.pdf`)
}
