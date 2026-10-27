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

export type MedicationRequestSource = {
  id: string;
  orderNo: string;
  status: string;
  priority?: string | null;
  patientId: string;
  encounterId?: string | null;
  requesterId?: string | null;
  authoredOn?: string | Date | null;
  itemId?: string | null;
  sku?: string | null;
  medicationName: string;
  dose?: string | null;
  route?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity?: number | null;
  unit?: string | null;
  instructions?: string | null;
};

export type MedicationDispenseSource = {
  id: string;
  orderId: string;
  status: string;
  patientId: string;
  encounterId?: string | null;
  performerId?: string | null;
  whenHandedOver?: string | Date | null;
  itemId?: string | null;
  sku?: string | null;
  medicationName: string;
  quantityDispensed: number;
  unit?: string | null;
  batchNo?: string | null;
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

export function mapMedicationRequest(source: MedicationRequestSource) {
  const gaps: string[] = [];
  if (!source.patientId) gaps.push('MedicationRequest.subject');
  if (!source.medicationName) gaps.push('MedicationRequest.medicationCodeableConcept');
  if (!source.itemId) gaps.push('MedicationRequest.medicationCodeableConcept.coding');
  if (!(Number(source.quantity) > 0)) gaps.push('MedicationRequest.dispenseRequest.quantity');

  const statusMap: Record<string, string> = {
    requested: 'active',
    partially_dispensed: 'active',
    dispensed: 'completed',
    cancelled: 'cancelled',
  };

  return {
    resourceType: 'MedicationRequest' as const,
    id: source.id,
    meta: { profile: [KENYA_CORE_PROFILES.MedicationRequest] },
    identifier: [{ system: 'https://jalaram.local/clinical-order', value: source.orderNo }],
    status: statusMap[source.status] ?? 'active',
    intent: 'order' as const,
    priority: (source.priority as 'routine' | 'urgent' | 'stat') ?? 'routine',
    medicationCodeableConcept: {
      text: source.medicationName,
      coding: source.itemId
        ? [
            {
              system: 'https://jalaram.local/catalogue-item',
              code: source.sku || source.itemId,
              display: source.medicationName,
            },
          ]
        : [],
    },
    subject: { reference: `Patient/${source.patientId}` },
    encounter: source.encounterId ? { reference: `Encounter/${source.encounterId}` } : undefined,
    authoredOn: source.authoredOn ? new Date(source.authoredOn).toISOString() : undefined,
    requester: source.requesterId ? { reference: `Practitioner/${source.requesterId}` } : undefined,
    dosageInstruction: [
      {
        text: [source.dose, source.route, source.frequency, source.duration, source.instructions]
          .filter(Boolean)
          .join(' · '),
        route: source.route ? { text: source.route } : undefined,
      },
    ],
    dispenseRequest:
      Number(source.quantity) > 0
        ? {
            quantity: {
              value: Number(source.quantity),
              unit: source.unit ?? 'unit',
            },
          }
        : undefined,
    _mappingGaps: gaps,
  };
}

export function mapMedicationDispense(source: MedicationDispenseSource) {
  const gaps: string[] = [];
  if (!source.patientId) gaps.push('MedicationDispense.subject');
  if (!source.medicationName) gaps.push('MedicationDispense.medicationCodeableConcept');
  if (!(Number(source.quantityDispensed) > 0)) gaps.push('MedicationDispense.quantity');

  return {
    resourceType: 'MedicationDispense' as const,
    id: source.id,
    meta: { profile: [KENYA_CORE_PROFILES.MedicationDispense] },
    status: source.status === 'dispensed' ? 'completed' : 'in-progress',
    medicationCodeableConcept: {
      text: source.medicationName,
      coding: source.itemId
        ? [
            {
              system: 'https://jalaram.local/catalogue-item',
              code: source.sku || source.itemId,
              display: source.medicationName,
            },
          ]
        : [],
    },
    subject: { reference: `Patient/${source.patientId}` },
    context: source.encounterId ? { reference: `Encounter/${source.encounterId}` } : undefined,
    authorizingPrescription: [{ reference: `MedicationRequest/${source.orderId}` }],
    quantity: {
      value: Number(source.quantityDispensed),
      unit: source.unit ?? 'unit',
    },
    whenHandedOver: source.whenHandedOver ? new Date(source.whenHandedOver).toISOString() : undefined,
    performer: source.performerId
      ? [{ actor: { reference: `Practitioner/${source.performerId}` } }]
      : undefined,
    _mappingGaps: gaps,
  };
}
