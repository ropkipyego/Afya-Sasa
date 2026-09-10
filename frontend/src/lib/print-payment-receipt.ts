import { openPrintHtml } from './template-engine'
import { formatKes } from './clinical-catalog'

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
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printPaymentReceipt(data: PaymentReceiptData) {
  const amount =
    typeof data.amount === 'number' || data.amount
      ? formatKes(Number(data.amount))
      : '—'
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    body { font-family: ui-monospace, Consolas, monospace; margin: 0; color: #111; font-size: 12px; }
    .wrap { width: 68mm; margin: 0 auto; }
    h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
    .muted { color: #444; text-align: center; font-size: 10px; margin: 0; }
    hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
    .total { font-size: 16px; font-weight: 700; }
    .thanks { text-align: center; margin-top: 12px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(data.facilityName)}</h1>
    ${data.address ? `<p class="muted">${escapeHtml(data.address)}</p>` : ''}
    ${data.phone ? `<p class="muted">${escapeHtml(data.phone)}</p>` : ''}
    <p class="muted">Official receipt</p>
    <hr />
    <div class="row"><span>Date</span><span>${escapeHtml(new Date(data.paidAt).toLocaleString())}</span></div>
    <div class="row"><span>Patient</span><span>${escapeHtml(data.patientName)}</span></div>
    <div class="row"><span>No.</span><span>${escapeHtml(data.patientNo)}</span></div>
    <div class="row"><span>Service</span><span>${escapeHtml(data.service)}</span></div>
    <div class="row"><span>Method</span><span>${escapeHtml(data.method)}</span></div>
    ${data.reference ? `<div class="row"><span>Ref</span><span>${escapeHtml(data.reference)}</span></div>` : ''}
    <hr />
    <div class="row total"><span>Paid</span><span>${escapeHtml(amount)}</span></div>
    <p class="thanks">Thank you</p>
  </div>
</body>
</html>`
  openPrintHtml(html, 'Receipt')
}
