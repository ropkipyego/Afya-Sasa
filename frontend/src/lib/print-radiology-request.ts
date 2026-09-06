import { openPrintHtml } from './template-engine'
import {
  examLabelForKey,
  JALARAM_EXAM_TYPES,
  type JalaramImagingRequestPrintData,
} from './jalaram-imaging-request'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function check(checked: boolean) {
  return checked ? '☑' : '☐'
}

function splitFacilityTitle(name: string, primary: string, accent: string) {
  const upper = name.toUpperCase()
  if (upper.includes('JALARAM') && upper.includes('CHRISTOPHER')) {
    const parts = name.split(/\s+ST\.?\s+/i)
    if (parts.length >= 2) {
      return `<span style="color:${primary};font-weight:800">JALARAM</span> <span style="color:${accent};font-weight:800">ST. ${escapeHtml(parts[1]!.toUpperCase())}</span>`
    }
  }
  return `<span style="color:${primary};font-weight:800">${escapeHtml(name.toUpperCase())}</span>`
}

export function buildJalaramImagingRequestHtml(data: JalaramImagingRequestPrintData) {
  const b = data.branding
  const primary = b.primaryColor
  const accent = b.accentColor
  const logo = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="" style="height:72px;object-fit:contain" />`
    : `<div style="width:72px;height:72px;border-radius:12px;background:linear-gradient(135deg,${primary},${accent});display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px">+</div>`

  const examRows = JALARAM_EXAM_TYPES.map(
    (exam) =>
      `<span style="display:inline-block;min-width:48%;margin:4px 0;font-size:13px">${check(data.examTypes.includes(exam.key))} ${exam.label}</span>`,
  ).join('')

  const gi = data.generalInformation

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<title>Imaging Request${data.requestNo ? ` — ${escapeHtml(data.requestNo)}` : ''}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 13px; line-height: 1.45; }
  .sheet { max-width: 210mm; margin: 0 auto; border: 2px solid ${primary}; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px 8px; border-bottom: 2px solid ${primary}; }
  .title { text-align: center; font-size: 20px; letter-spacing: 0.04em; margin: 8px 0 4px; }
  .tagline { background: ${primary}; color: #fff; text-align: center; font-weight: 700; font-size: 12px; padding: 6px 12px; letter-spacing: 0.06em; }
  .date-row { text-align: right; padding: 8px 20px 0; font-weight: 600; }
  .section { margin: 0; border-bottom: 1px solid #cbd5e1; }
  .section-h { background: ${primary}; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 6px 12px; text-transform: uppercase; }
  .section-h.pink { background: #e11d48; }
  .section-b { padding: 12px 16px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { margin-bottom: 8px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${primary}; margin-bottom: 2px; }
  .value { background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 4px; padding: 6px 8px; min-height: 18px; }
  .value.pink { background: #ffe4e6; border-color: #fecdd3; }
  .checks { line-height: 1.8; }
  .box { border: 2px solid ${primary}; border-radius: 8px; padding: 10px 12px; margin-top: 8px; font-size: 12px; }
  .footer { background: ${primary}; color: #fff; text-align: center; padding: 10px 16px; font-size: 11px; }
  .sig-line { border-bottom: 1px dotted #64748b; min-height: 22px; margin-top: 4px; }
  .meta { font-size: 10px; color: #64748b; text-align: center; margin-top: 6px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="header">
    <div>${logo}</div>
    <div style="flex:1;text-align:center;padding:0 12px">
      <div class="title">${splitFacilityTitle(b.facilityName, primary, accent)}</div>
    </div>
    <div style="min-width:140px"><div class="tagline">${escapeHtml(b.tagline ?? 'Caring Hearts Healing Hands')}</div></div>
  </div>
  <div class="date-row">DATE: ${escapeHtml(data.requestDate)}${data.requestNo ? ` &nbsp;|&nbsp; Ref: ${escapeHtml(data.requestNo)}` : ''}</div>

  <div class="section">
    <div class="section-h">Patient details</div>
    <div class="section-b grid2">
      <div class="field" style="grid-column:1/-1"><div class="label">Full name</div><div class="value">${escapeHtml(data.patientName)}${data.patientNo ? ` (${escapeHtml(data.patientNo)})` : ''}</div></div>
      <div class="field"><div class="label">Age</div><div class="value">${escapeHtml(data.age)}</div></div>
      <div class="field"><div class="label">Gender</div><div class="value">${escapeHtml(data.gender)}</div></div>
      ${data.lmp ? `<div class="field" style="grid-column:1/-1"><div class="label">LMP</div><div class="value">${escapeHtml(data.lmp)}</div></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-h">Type of examination</div>
    <div class="section-b">
      <div class="checks">${examRows}</div>
      <div class="field" style="margin-top:10px"><div class="label">Requested investigation</div><div class="value">${escapeHtml(data.requestedInvestigation ?? '')}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-h">Urgency &amp; general information</div>
    <div class="section-b">
      <p style="margin:0 0 8px;font-weight:600">Is the investigation so urgent (e.g. RTA or pulmonary embolism)? ${check(data.urgencyUrgent)} Yes &nbsp; ${check(!data.urgencyUrgent)} No</p>
      <div class="checks">
        <div>${check(gi.contrastAllergy)} The patient is allergic to contrast</div>
        <div>${check(gi.kidneyLiverDisease)} Patient has kidney or liver disease</div>
        <div>${check(gi.vitallyUnstable)} Patient vitally unstable</div>
        <div>${check(gi.requiresOxygen)} Patient is requiring oxygen?</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-h pink">Clinical details</div>
    <div class="section-b">
      <div class="field"><div class="label">Diagnosis</div><div class="value pink">${escapeHtml(data.diagnosis).replace(/\n/g, '<br/>')}</div></div>
      <div class="field"><div class="label">Brief history</div><div class="value pink">${escapeHtml(data.briefHistory).replace(/\n/g, '<br/>')}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-h">Referring provider</div>
    <div class="section-b grid2">
      <div class="field"><div class="label">Doctor name</div><div class="sig-line">${escapeHtml(data.doctorName)}</div></div>
      <div class="field"><div class="label">Facility name</div><div class="sig-line">${escapeHtml(data.facilityName ?? '')}</div></div>
      <div class="field"><div class="label">Phone number</div><div class="sig-line">${escapeHtml(data.doctorPhone ?? '')}</div></div>
    </div>
  </div>

  <div class="section-b grid2">
    <div class="box">
      <strong style="color:${primary}">For the patient</strong>
      <ol style="margin:8px 0 0;padding-left:18px;font-size:11px">
        <li>If you are pregnant or suspect you might be pregnant, please inform the radiographer / doctor.</li>
        <li>Please carry any previous imaging studies along with you.</li>
      </ol>
    </div>
    <div class="box">
      <strong>For the radiographer</strong>
      <div class="grid2" style="margin-top:8px;font-size:11px">
        <div>Date:<div class="sig-line"></div></div>
        <div>Time:<div class="sig-line"></div></div>
      </div>
      <div style="margin-top:8px;font-size:11px">Signature:<div class="sig-line"></div></div>
    </div>
  </div>

  <div class="footer">
    <div><strong>Phone:</strong> ${escapeHtml(b.contactPhone ?? '')}</div>
    <div><strong>Email:</strong> ${escapeHtml(b.contactEmail ?? '')} · ${escapeHtml(b.address ?? '')}</div>
    ${b.website ? `<div>${escapeHtml(b.website)}</div>` : ''}
  </div>
</div>
<p class="meta">Printed from AfyaSasa · ${escapeHtml(b.facilityName)}</p>
</body></html>`
}

export function printJalaramImagingRequest(data: JalaramImagingRequestPrintData) {
  const html = buildJalaramImagingRequestHtml(data)
  openPrintHtml(html, `Imaging Request${data.requestNo ? ` — ${data.requestNo}` : ''}`)
}

export function summarizeExamSelection(examTypes: string[], requestedInvestigation?: string | null) {
  const labels = examTypes.map(examLabelForKey)
  if (requestedInvestigation?.trim()) labels.push(requestedInvestigation.trim())
  return labels.filter(Boolean).join(', ')
}
