import { isMinorPatient, normalizePhoneDigits, patientAgeYears, phonesLookAlike } from './patient.rules';

describe('patient.rules', () => {
  const now = new Date('2026-09-11T12:00:00+03:00');

  it('calculates age from date of birth', () => {
    expect(patientAgeYears('2010-09-11', now)).toBe(16);
    expect(patientAgeYears('2010-09-12', now)).toBe(15);
    expect(patientAgeYears('2008-09-11', now)).toBe(18);
    expect(patientAgeYears('not-a-date', now)).toBe(-1);
  });

  it('treats patients under 18 as minors', () => {
    expect(isMinorPatient('2008-09-12', now)).toBe(true);
    expect(isMinorPatient('2008-09-11', now)).toBe(false);
    expect(isMinorPatient('2020-01-01', now)).toBe(true);
    expect(isMinorPatient('invalid', now)).toBe(false);
  });

  it('normalizes phone digits and compares last 9 digits', () => {
    expect(normalizePhoneDigits('+254 712 345 678')).toBe('254712345678');
    expect(phonesLookAlike('+254712345678', '0712345678')).toBe(true);
    expect(phonesLookAlike('0712345678', '0711111111')).toBe(false);
    expect(phonesLookAlike('123', '123')).toBe(false);
  });
});
