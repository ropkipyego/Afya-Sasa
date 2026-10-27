export function theatreMayEnter(
  consentStatus?: string | null,
  checklistStatus?: string | null,
  priority?: string | null,
) {
  const consentOk =
    priority === 'emergency' || consentStatus === 'signed' || consentStatus === 'not_required'
  return consentOk && checklistStatus === 'complete'
}
