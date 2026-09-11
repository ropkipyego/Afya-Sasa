export function patientAgeYears(dateOfBirth: string, now = new Date()): number {
  const dob = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dob.getTime())) {
    return -1;
  }
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function isMinorPatient(dateOfBirth: string, now = new Date()): boolean {
  const age = patientAgeYears(dateOfBirth, now);
  return age >= 0 && age < 18;
}

export function normalizePhoneDigits(phone?: string | null): string {
  return String(phone ?? '').replace(/\D/g, '');
}

export function phonesLookAlike(left?: string | null, right?: string | null): boolean {
  const a = normalizePhoneDigits(left);
  const b = normalizePhoneDigits(right);
  if (a.length < 7 || b.length < 7) return false;
  return a === b || a.slice(-9) === b.slice(-9);
}
