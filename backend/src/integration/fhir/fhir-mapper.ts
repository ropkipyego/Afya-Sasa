import { KENYA_CORE_PROFILES } from './kenya-core';

export type PatientSource = {
  id: string;
  patientNo: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  primaryPhone?: string | null;
  email?: string | null;
  county?: string | null;
  subCounty?: string | null;
  identifiers?: Array<{ type: string; value: string }>;
};

export type EncounterSource = {
  id: string;
  type: string;
  status: string;
  startedAt?: string | Date | null;
  patientId: string;
};

export type ObservationSource = {
  id: string;
  code: string;
  display: string;
  value?: string | number | null;
  unit?: string | null;
  effectiveAt?: string | Date | null;
  patientId: string;
};

function fhirGender(gender: string) {
  if (gender === 'male' || gender === 'female' || gender === 'unknown') return gender;
  if (gender === 'intersex') return 'other';
  return 'unknown';
}

export function mapPatient(source: PatientSource) {
  const identifiers = [
    {
      system: 'https://jalaram.local/patient-no',
      value: source.patientNo,
    },
    ...(source.identifiers ?? []).map((row) => ({
      system: `https://jalaram.local/id/${row.type}`,
      value: row.value,
    })),
  ];
  const gaps: string[] = [];
  if (!source.patientNo) gaps.push('Patient.identifier');
  if (!source.firstName || !source.lastName) gaps.push('Patient.name');
  if (!source.dateOfBirth) gaps.push('Patient.birthDate');
  if (!source.gender) gaps.push('Patient.gender');

  return {
    resourceType: 'Patient' as const,
    id: source.id,
    meta: { profile: [KENYA_CORE_PROFILES.Patient] },
    identifier: identifiers,
    name: [
      {
        use: 'official',
        family: source.lastName,
        given: [source.firstName, source.middleName].filter(Boolean),
      },
    ],
    gender: fhirGender(source.gender),
    birthDate: source.dateOfBirth,
    telecom: [
      source.primaryPhone ? { system: 'phone', value: source.primaryPhone } : null,
      source.email ? { system: 'email', value: source.email } : null,
    ].filter(Boolean),
    address: source.county
      ? [
          {
            use: 'home',
            country: 'KE',
            district: source.county,
            city: source.subCounty ?? undefined,
          },
        ]
      : [],
    _mappingGaps: gaps,
  };
}

export function mapEncounter(source: EncounterSource) {
  const gaps: string[] = [];
  if (!source.patientId) gaps.push('Encounter.subject');
  if (!source.startedAt) gaps.push('Encounter.period.start');
  const status =
    source.status === 'completed' || source.status === 'closed'
      ? 'finished'
      : source.status === 'cancelled'
        ? 'cancelled'
        : 'in-progress';
  return {
    resourceType: 'Encounter' as const,
    id: source.id,
    meta: { profile: [KENYA_CORE_PROFILES.Encounter] },
    status,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: source.type === 'inpatient' ? 'IMP' : 'AMB',
    },
    subject: { reference: `Patient/${source.patientId}` },
    period: source.startedAt
      ? { start: new Date(source.startedAt).toISOString() }
      : undefined,
    _mappingGaps: gaps,
  };
}

export function mapObservation(source: ObservationSource) {
  const gaps: string[] = [];
  if (!source.code) gaps.push('Observation.code');
  if (source.value == null) gaps.push('Observation.value');
  return {
    resourceType: 'Observation' as const,
    id: source.id,
    meta: { profile: [KENYA_CORE_PROFILES.Observation] },
    status: 'final',
    code: { text: source.display, coding: [{ code: source.code, display: source.display }] },
    subject: { reference: `Patient/${source.patientId}` },
    effectiveDateTime: source.effectiveAt
      ? new Date(source.effectiveAt).toISOString()
      : undefined,
    valueQuantity:
      typeof source.value === 'number'
        ? { value: source.value, unit: source.unit ?? undefined }
        : undefined,
    valueString: typeof source.value === 'string' ? source.value : undefined,
    _mappingGaps: gaps,
  };
}
