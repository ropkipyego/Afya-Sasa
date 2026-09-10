import { normalizeClinicalCatalog, type ClinicalCatalog } from './clinical-catalog'
import { apiRequest } from './api'
import { openPrintHtml } from './template-engine'

type PatientRecord = {
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  bloodGroup?: string | null
  primaryPhone: string
  nextOfKin?: {
    name: string
    primaryPhone: string
    isEmergencyContact?: boolean
  }[]
}

type QrCard = {
  qrDataUrl: string
  qrCode: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPatientCardHtml({
  patient,
  qr,
  catalog,
}: {
  patient: PatientRecord
  qr: QrCard
  catalog?: ClinicalCatalog | null
}) {
  const profile = normalizeClinicalCatalog(catalog).hospitalProfile ?? {}
  const emergency =
    patient.nextOfKin?.find((kin) => kin.isEmergencyContact) ?? patient.nextOfKin?.[0] ?? null
  const primaryColor = profile.primaryColor ?? '#0d9488'
  const facilityName = profile.facilityName ?? 'Hospital'
  const logo = profile.logoUrl
    ? `<img src="${escapeHtml(profile.logoUrl)}" alt="" style="height:40px;object-fit:contain;margin-bottom:8px" />`
    : ''
  const tagline = profile.tagline
    ? `<p style="margin:4px 0 0;font-size:11px;color:#64748b">${escapeHtml(profile.tagline)}</p>`
    : ''
  const bloodRow = patient.bloodGroup
    ? `<p class="row"><span class="label">Blood group</span><span class="value">${escapeHtml(patient.bloodGroup)}</span></p>`
    : ''
  const emergencyRow = emergency
    ? `<p class="row"><span class="label">Emergency contact</span><span class="value">${escapeHtml(emergency.name)} · ${escapeHtml(emergency.primaryPhone)}</span></p>`
    : ''
  const footer = profile.footerText
    ? `<p class="footer">${escapeHtml(profile.footerText)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Patient card — ${escapeHtml(patient.patientNo)}</title>
  <style>
    @page { size: A6 portrait; margin: 12mm; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #fff;
    }
    .card {
      max-width: 400px;
      margin: 0 auto;
      border: 2px solid #cbd5e1;
      border-radius: 16px;
      padding: 24px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .facility {
      font-size: 18px;
      font-weight: 700;
      color: ${escapeHtml(primaryColor)};
      margin: 0;
    }
    .qr {
      width: 96px;
      height: 96px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .name {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 12px;
    }
    .row {
      margin: 6px 0;
      font-size: 14px;
      line-height: 1.4;
    }
    .label {
      color: #64748b;
    }
    .value {
      font-weight: 600;
      color: #1e293b;
    }
    .code {
      display: none;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div>
        ${logo}
        <p class="facility">${escapeHtml(facilityName)}</p>
        ${tagline}
      </div>
      <img class="qr" src="${qr.qrDataUrl}" alt="Patient QR code" />
    </div>
    <p class="name">${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}</p>
    <p class="row"><span class="label">MRN</span> <span class="value">${escapeHtml(patient.patientNo)}</span></p>
    <p class="row"><span class="label">Date of birth</span> <span class="value">${escapeHtml(patient.dateOfBirth)}</span></p>
    <p class="row"><span class="label">Gender</span> <span class="value">${escapeHtml(patient.gender)}</span></p>
    ${bloodRow}
    <p class="row"><span class="label">Phone</span> <span class="value">${escapeHtml(patient.primaryPhone)}</span></p>
    ${emergencyRow}
    <p class="code"></p>
    ${footer}
  </div>
</body>
</html>`
}

export async function printPatientCard(patientId: string, catalog?: ClinicalCatalog | null) {
  const origin = window.location.origin
  const [patient, qr] = await Promise.all([
    apiRequest<PatientRecord>(`/patients/${patientId}`),
    apiRequest<QrCard>(`/patients/${patientId}/qr-card?origin=${encodeURIComponent(origin)}`),
  ])

  const html = buildPatientCardHtml({ patient, qr, catalog })
  openPrintHtml(html, `Patient card — ${patient.patientNo}`)
}
