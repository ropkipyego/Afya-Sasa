/** Kenya Core FHIR IG v1.0.0 — FHIR R4 (4.0.1). eClaims IG is draft. */

export const FHIR_R4_VERSION = '4.0.1';
export const KENYA_CORE_IG_VERSION = '1.0.0';
export const KENYA_CORE_IG_URL = 'https://fhir.dha.go.ke/ig/core/';
export const KENYA_ECLAIMS_IG_URL = 'https://fhir.dha.go.ke/ig/eclaims';
export const KENYA_ECLAIMS_STATUS = 'draft';

export const KENYA_CORE_PROFILES = {
  Patient: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-patient',
  Practitioner: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-practitioner',
  Organization: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-organization',
  Location: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-location',
  Encounter: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-encounter',
  Observation: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-observation',
  Condition: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-condition',
  Procedure: 'https://fhir.dha.go.ke/ig/core/StructureDefinition/kenya-core-procedure',
} as const;

export type MappingGap = {
  profile: string;
  element: string;
  required: boolean;
  source: string;
  mapping: string | null;
  missing: boolean;
  note: string;
};

export const PATIENT_GAPS: MappingGap[] = [
  {
    profile: KENYA_CORE_PROFILES.Patient,
    element: 'Patient.identifier',
    required: true,
    source: 'demo.patient_identifiers / demo.patients.patient_no',
    mapping: 'identifier[]',
    missing: false,
    note: 'Hospital MRN always mapped. National ID / SHA only when captured.',
  },
  {
    profile: KENYA_CORE_PROFILES.Patient,
    element: 'Patient.name',
    required: true,
    source: 'demo.patients first_name, middle_name, last_name',
    mapping: 'name[0].given / family',
    missing: false,
    note: '',
  },
  {
    profile: KENYA_CORE_PROFILES.Patient,
    element: 'Patient.gender',
    required: true,
    source: 'demo.patients.gender',
    mapping: 'gender',
    missing: false,
    note: 'intersex maps to other.',
  },
  {
    profile: KENYA_CORE_PROFILES.Patient,
    element: 'Patient.birthDate',
    required: true,
    source: 'demo.patients.date_of_birth',
    mapping: 'birthDate',
    missing: false,
    note: '',
  },
  {
    profile: KENYA_CORE_PROFILES.Patient,
    element: 'Patient.telecom',
    required: false,
    source: 'demo.patients.primary_phone, email',
    mapping: 'telecom',
    missing: false,
    note: '',
  },
  {
    profile: KENYA_CORE_PROFILES.Patient,
    element: 'Patient.address',
    required: false,
    source: 'demo.patients county, sub_county, ward',
    mapping: 'address',
    missing: false,
    note: 'Kenya administrative geography; not a postal address object.',
  },
];

export const ECLAIMS_GAPS: MappingGap[] = [
  {
    profile: 'Kenya eClaims (draft)',
    element: 'Coverage',
    required: true,
    source: 'sha_eligibility_checks + insurance overlay',
    mapping: null,
    missing: true,
    note: 'No persistent Coverage resource. Eligibility snapshots are not membership proof.',
  },
  {
    profile: 'Kenya eClaims (draft)',
    element: 'Claim.item',
    required: true,
    source: 'demo.charges',
    mapping: 'operational claim draft items',
    missing: true,
    note: 'Draft IG. Do not POST to SHA from this mapping.',
  },
  {
    profile: 'Kenya eClaims (draft)',
    element: 'ClaimResponse / remittance',
    required: true,
    source: 'none',
    mapping: null,
    missing: true,
    note: 'No remittance table. Portal remains source of adjudication until an approved pack exists.',
  },
  {
    profile: 'Kenya eClaims (draft)',
    element: 'Encounter diagnosis / procedure',
    required: true,
    source: 'demo.encounter_diagnoses, clinical orders',
    mapping: 'Condition / Procedure when coded',
    missing: true,
    note: 'ICD-11 bindings are not enforced in-app.',
  },
];
