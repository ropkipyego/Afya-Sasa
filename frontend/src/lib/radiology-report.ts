/** Shared radiology report payload. UI and API both require a RadWeb / image URL. */

export type RadiologyReportBody = {
  findings: string
  impression: string
  recommendation?: string
  imageUrl: string
}

export function radiologyReportBodyFromForm(form: FormData): RadiologyReportBody {
  const findings = String(form.get('findings') ?? '').trim()
  const impression = String(form.get('impression') ?? '').trim()
  const recommendation = String(form.get('recommendation') ?? '').trim()
  const imageUrl = String(form.get('imageUrl') ?? '').trim()
  return {
    findings,
    impression,
    ...(recommendation ? { recommendation } : {}),
    imageUrl,
  }
}

export function radiologyReportReady(body: RadiologyReportBody): string | null {
  if (!body.findings) return 'Findings are required.'
  if (!body.impression) return 'Impression is required.'
  if (!/^https?:\/\/\S+$/i.test(body.imageUrl)) {
    return 'A RadWeb / image link is required before the imaging report can be saved.'
  }
  return null
}
