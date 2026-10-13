export type MohFormMap = {
  code: string
  officialName: string
  period: string
  source: string
  endpoint: string | null
  submission: 'manual_print' | 'requires_official_spec' | 'not_in_model'
  categories: string[]
  fields: Array<{ name: string; source: string; status: 'mapped' | 'partial' | 'missing_spec' }>
  gaps: string[]
}

export const MOH_FORM_MAP: MohFormMap[] = [
  {
    code: 'MOH705A',
    officialName: 'MOH 705A Outpatient morbidity under 5 years',
    period: 'Monthly',
    source: 'encounters + diagnoses + patient date of birth',
    endpoint: '/reports/moh-705a',
    submission: 'manual_print',
    categories: ['OPD', 'Under 5'],
    fields: [
      { name: 'Facility name / MOH code', source: 'tenant settings', status: 'mapped' },
      { name: 'Disease line items', source: 'diagnosis keywords (internal projection)', status: 'partial' },
      { name: 'Age band <5', source: 'patients.date_of_birth', status: 'mapped' },
    ],
    gaps: [
      'Official KHIS codebook not in this repository. Line matching is keyword-based, not ICD-validated.',
      'Electronic KHIS submission is not implemented.',
    ],
  },
  {
    code: 'MOH705B',
    officialName: 'MOH 705B Outpatient morbidity 5 years and above',
    period: 'Monthly',
    source: 'encounters + diagnoses + patient date of birth',
    endpoint: '/reports/moh-705b',
    submission: 'manual_print',
    categories: ['OPD', '5 years and above'],
    fields: [
      { name: 'Adult disease lines including NCD', source: 'diagnosis keywords', status: 'partial' },
    ],
    gaps: ['Same KHIS gap as 705A.'],
  },
  {
    code: 'MOH706',
    officialName: 'MOH 706 Laboratory summary',
    period: 'Monthly',
    source: 'lab_requests / lab results grouped by catalogue category',
    endpoint: '/reports/moh-706',
    submission: 'manual_print',
    categories: ['Laboratory'],
    fields: [
      { name: 'Tests done / positive', source: 'lab_requests', status: 'partial' },
    ],
    gaps: [
      'Official MOH 240 B–G register layouts were not uploaded with this task.',
      'Positive counts depend on result flags; missing flags stay uncounted.',
    ],
  },
  {
    code: 'MOH717',
    officialName: 'MOH 717 Service workload',
    period: 'Monthly',
    source: 'encounters, admissions, emergency, maternity operational counts',
    endpoint: '/reports/moh-717',
    submission: 'manual_print',
    categories: ['Facility summary'],
    fields: [{ name: 'Workload counts', source: 'operational tables', status: 'partial' }],
    gaps: ['Not a KHIS upload. Print/export only.'],
  },
  {
    code: 'MOH204A',
    officialName: 'MOH 204A Outpatient register',
    period: 'Daily register',
    source: 'encounters',
    endpoint: null,
    submission: 'requires_official_spec',
    categories: ['OPD register'],
    fields: [],
    gaps: ['Official blank/spec was not present in the workspace. Do not invent columns.'],
  },
  {
    code: 'MOH333',
    officialName: 'MOH 333 Maternity register',
    period: 'Register',
    source: 'pregnancies / deliveries',
    endpoint: null,
    submission: 'requires_official_spec',
    categories: ['Maternity'],
    fields: [],
    gaps: ['Operational maternity workspace exists; official 333 field list was not uploaded.'],
  },
]

export function mohMappingReport() {
  return {
    generatedAt: new Date().toISOString(),
    electronicSubmissionOperational: false,
    note: 'No Ministry PDF/XLS templates were present in the repository for this task. Mapping uses existing AfyaSasa projections only.',
    forms: MOH_FORM_MAP,
  }
}
