/** Display label for a clinical staff member (doctor, consultant, etc.). */
export function formatClinicianName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
  fallback = '—',
): string {
  if (!user) return fallback;
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  if (!name) return fallback;
  return name.startsWith('Dr.') ? name : `Dr. ${name}`;
}
