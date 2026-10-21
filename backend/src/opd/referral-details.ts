export type ReferringDetails = {
  facility: string
  doctorName: string
  doctorPhone: string
  doctorNumber: string
}

export function packReferringDetails(details: ReferringDetails): string | null {
  const facility = details.facility.trim()
  const doctorName = details.doctorName.trim()
  const doctorPhone = details.doctorPhone.trim()
  const doctorNumber = details.doctorNumber.trim()
  if (!facility && !doctorName && !doctorPhone && !doctorNumber) return null
  return JSON.stringify({ v: 1, facility, doctorName, doctorPhone, doctorNumber })
}

export function unpackReferringDetails(raw?: string | null): ReferringDetails {
  const empty = { facility: '', doctorName: '', doctorPhone: '', doctorNumber: '' }
  if (!raw?.trim()) return empty
  try {
    const parsed = JSON.parse(raw) as Partial<ReferringDetails> & { v?: number }
    if (parsed?.v === 1) {
      return {
        facility: String(parsed.facility ?? '').trim(),
        doctorName: String(parsed.doctorName ?? '').trim(),
        doctorPhone: String(parsed.doctorPhone ?? '').trim(),
        doctorNumber: String(parsed.doctorNumber ?? '').trim(),
      }
    }
  } catch {
    /* stored as a plain facility name */
  }
  return { ...empty, facility: raw.trim() }
}

export function referringFacilityLabel(raw?: string | null): string {
  const details = unpackReferringDetails(raw)
  return details.facility || raw?.trim() || 'unknown'
}
