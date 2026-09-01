import type { HospitalProfile } from './clinical-catalog'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildLetterheadHtml(profile?: Partial<HospitalProfile> | null) {
  const primaryColor = profile?.primaryColor ?? '#0d9488'
  const facilityName = profile?.facilityName ?? 'Hospital'
  const logo = profile?.logoUrl
    ? `<img src="${escapeHtml(profile.logoUrl)}" alt="" style="max-height:56px;object-fit:contain;margin:0 auto 8px;display:block" />`
    : ''
  const tagline = profile?.tagline
    ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b">${escapeHtml(profile.tagline)}</p>`
    : ''
  const addressLine = profile?.address || profile?.physicalAddress
    ? `<p style="margin:4px 0 0;font-size:11px;color:#64748b">${escapeHtml((profile?.address || profile?.physicalAddress)!)}</p>`
    : ''
  const contact = profile?.contactPhone
    ? `<p style="margin:2px 0 0;font-size:11px;color:#64748b">Tel: ${escapeHtml(profile.contactPhone)}</p>`
    : ''
  return `${logo}<h1 style="color:${escapeHtml(primaryColor)};margin:0;font-size:1.35rem">${escapeHtml(facilityName)}</h1>${tagline}${addressLine}${contact}`
}

export function buildStampHtml(profile?: Partial<HospitalProfile> | null) {
  if (profile?.stampUrl) {
    return `<img src="${escapeHtml(profile.stampUrl)}" alt="Hospital stamp" style="max-height:72px;object-fit:contain" />`
  }
  return '<div class="box">Hospital stamp</div>'
}
