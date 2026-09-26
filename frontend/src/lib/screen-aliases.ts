/** Map retired nav labels to current screens (sessionStorage migration). */
export const SCREEN_ALIASES: Record<string, string> = {
  'Patient Search': 'Register Patient',
  'Patient Timeline': 'Register Patient',
  'OPD Patients': 'All Queues',
  'Lab Patients': 'Lab Queue',
  'Imaging Patients': 'Imaging Queue',
  'IPD Patients': 'All Queues',
  'ED Patients': 'All Queues',
  'Care Queues': 'All Queues',
  'Lab Dashboard': 'Laboratory',
  'Imaging Dashboard': 'Radiology',
  'Results Inbox': 'Laboratory',
  'Clinical Orders': 'Orders',
  Worklists: 'All Queues',
  Reception: 'Front Office',
  'OPD Reports': 'Reports',
  'Clinical Reports': 'Reports',
  'Executive Analytics': 'Reports',
  'Operations Center': 'Reports',
  Notifications: 'Register Patient',
  Pharmacy: 'Pharmacy',
  Payments: 'Finance',
}

export function resolveScreen(label: string): string {
  const trimmed = label?.trim()
  if (!trimmed) return 'OPD Check-In'
  return SCREEN_ALIASES[trimmed] ?? trimmed
}
