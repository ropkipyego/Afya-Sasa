/** Kenya MOH 705A / 705B morbidity line items (simplified standard set). */
export type Moh705Line = {
  code: string
  label: string
  keywords: string[]
}

export const MOH_705A_LINES: Moh705Line[] = [
  { code: '01', label: 'Diarrhoea', keywords: ['diarr', 'gastroenteritis', 'dysentery'] },
  { code: '02', label: 'Malaria', keywords: ['malaria', 'plasmodium'] },
  { code: '03', label: 'Pneumonia', keywords: ['pneumonia', 'lower respiratory'] },
  { code: '04', label: 'Upper respiratory tract infections', keywords: ['urti', 'upper respiratory', 'common cold', 'pharyngitis'] },
  { code: '05', label: 'Ear infections', keywords: ['otitis', 'ear infection'] },
  { code: '06', label: 'Eye infections', keywords: ['conjunctivitis', 'eye infection', 'trachoma'] },
  { code: '07', label: 'Dental disorders', keywords: ['dental', 'tooth', 'caries'] },
  { code: '08', label: 'Skin diseases', keywords: ['dermatitis', 'scabies', 'skin', 'eczema'] },
  { code: '09', label: 'Urinary tract infections', keywords: ['uti', 'urinary tract'] },
  { code: '10', label: 'Anaemia', keywords: ['anaemia', 'anemia'] },
  { code: '11', label: 'Malnutrition', keywords: ['malnutrition', 'kwashiorkor', 'marasmus'] },
  { code: '12', label: 'Injuries / trauma', keywords: ['injury', 'trauma', 'fracture', 'burn'] },
  { code: '13', label: 'Measles', keywords: ['measles'] },
  { code: '14', label: 'Tuberculosis', keywords: ['tuberculosis', 'tb '] },
  { code: '15', label: 'HIV related conditions', keywords: ['hiv', 'aids'] },
  { code: '16', label: 'Typhoid', keywords: ['typhoid', 'salmonella'] },
  { code: '17', label: 'Meningitis', keywords: ['meningitis'] },
  { code: '18', label: 'Other fevers', keywords: ['fever', 'pyrexia'] },
  { code: '99', label: 'All other diseases', keywords: [] },
]

export const MOH_705B_LINES: Moh705Line[] = [
  ...MOH_705A_LINES.filter((line) => line.code !== '99'),
  { code: '20', label: 'Hypertension', keywords: ['hypertension', 'high blood pressure'] },
  { code: '21', label: 'Diabetes mellitus', keywords: ['diabetes', 'dm type'] },
  { code: '22', label: 'Mental disorders', keywords: ['depression', 'anxiety', 'psych', 'mental'] },
  { code: '23', label: 'STI', keywords: ['sti', 'sexually transmitted', 'gonorrh', 'syphilis'] },
  { code: '99', label: 'All other diseases', keywords: [] },
]

/** MOH 706 laboratory test groupings. */
export const MOH_706_GROUPS = [
  { code: 'UR', label: 'Urinalysis', categories: ['urinalysis'] },
  { code: 'HM', label: 'Haematology', categories: ['haematology', 'coagulation'] },
  { code: 'BC', label: 'Biochemistry', categories: ['biochemistry'] },
  { code: 'MB', label: 'Microbiology / serology', categories: ['microbiology', 'immunology'] },
] as const

export function matchMoh705Line(
  description: string,
  icd10: string | null | undefined,
  lines: Moh705Line[],
): string {
  const haystack = `${description} ${icd10 ?? ''}`.toLowerCase()
  for (const line of lines) {
    if (line.keywords.some((keyword) => haystack.includes(keyword))) {
      return line.code
    }
  }
  return '99'
}

export function ageInYears(dob: string | Date, at: Date): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob
  let age = at.getFullYear() - birth.getFullYear()
  const monthDiff = at.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}
