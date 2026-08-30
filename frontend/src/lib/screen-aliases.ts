/** Map retired nav labels to current screens (sessionStorage migration). */
export const SCREEN_ALIASES: Record<string, string> = {
  'Patient Search': 'Register Patient',
  'Patient Timeline': 'Register Patient',
  'OPD Patients': 'Worklists',
  'Lab Patients': 'Worklists',
  'Imaging Patients': 'Worklists',
  'IPD Patients': 'Worklists',
  'ED Patients': 'Worklists',
  'Lab Dashboard': 'Laboratory',
  'Imaging Dashboard': 'Radiology',
  'Results Inbox': 'Laboratory',
  'Clinical Orders': 'Orders',
  Worklists: 'Worklists',
  'OPD Reports': 'Reports',
  'Clinical Reports': 'Reports',
  'Executive Analytics': 'Reports',
  'Operations Center': 'Reports',
  Notifications: 'Register Patient',
  Pharmacy: 'Pharmacy',
}

export function resolveScreen(label: string): string {
  const trimmed = label?.trim()
  if (!trimmed) return 'OPD Check-In'
  return SCREEN_ALIASES[trimmed] ?? trimmed
}
