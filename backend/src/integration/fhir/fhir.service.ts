import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient, PatientIdentifier } from '../../patients/patient.entities';
import { Encounter } from '../../opd/opd.entities';
import {
  ECLAIMS_GAPS,
  FHIR_R4_VERSION,
  KENYA_CORE_IG_URL,
  KENYA_CORE_IG_VERSION,
  KENYA_CORE_PROFILES,
  KENYA_ECLAIMS_IG_URL,
  KENYA_ECLAIMS_STATUS,
  PATIENT_GAPS,
} from './kenya-core';
import { mapEncounter, mapPatient, type PatientSource } from './fhir-mapper';
import { validateMappedResource } from './fhir-validate';

@Injectable()
export class FhirService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientIdentifier)
    private readonly identifiers: Repository<PatientIdentifier>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
  ) {}

  status() {
    const baseUrl = this.config.get<string>('DHA_FHIR_BASE_URL')?.trim() || '';
    const clientId = this.config.get<string>('DHA_FHIR_CLIENT_ID')?.trim() || '';
    const sandboxEnabled = this.config.get<string>('DHA_FHIR_SANDBOX_ENABLED') === 'true';
    const credentialsReady = Boolean(baseUrl && clientId);
    return {
      standard: 'FHIR R4',
      fhirVersion: FHIR_R4_VERSION,
      kenyaCoreIg: { url: KENYA_CORE_IG_URL, version: KENYA_CORE_IG_VERSION },
      eClaimsIg: { url: KENYA_ECLAIMS_IG_URL, status: KENYA_ECLAIMS_STATUS },
      profiles: KENYA_CORE_PROFILES,
      connection: {
        state: !credentialsReady
          ? 'not_configured'
          : sandboxEnabled
            ? 'ready_for_sandbox_test'
            : 'not_configured',
        sandboxEnabled,
        credentialsReady,
        lastTestResult: null as string | null,
        connected: false,
        note: 'No outbound FHIR call is made from this status endpoint. Do not treat this as HIE connectivity.',
      },
      coverage: {
        kenyaCore: PATIENT_GAPS,
        eClaimsDraft: ECLAIMS_GAPS,
      },
    };
  }

  async mapPatientById(patientId: string) {
    const patient = await this.patients.findOne({ where: { id: patientId } });
    if (!patient) return { found: false as const };
    const identifiers = await this.identifiers.find({ where: { patient: { id: patient.id } } });
    const source: PatientSource = {
      id: patient.id,
      patientNo: patient.patientNo,
      firstName: patient.firstName,
      middleName: patient.middleName,
      lastName: patient.lastName,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      primaryPhone: patient.primaryPhone,
      email: patient.email,
      county: patient.county,
      subCounty: patient.subCounty,
      identifiers: identifiers.map((row) => ({ type: row.type, value: row.value })),
    };
    const resource = mapPatient(source);
    return {
      found: true as const,
      resource,
      validation: validateMappedResource(resource as unknown as Record<string, unknown>),
    };
  }

  async mapEncounterById(encounterId: string) {
    const encounter = await this.encounters.findOne({
      where: { id: encounterId },
      relations: { patient: true },
    });
    if (!encounter) return { found: false as const };
    const resource = mapEncounter({
      id: encounter.id,
      type: encounter.type,
      status: encounter.status,
      startedAt: encounter.startedAt,
      patientId: encounter.patient.id,
    });
    return {
      found: true as const,
      resource,
      validation: validateMappedResource(resource as unknown as Record<string, unknown>),
    };
  }

  validateSynthetic() {
    const resource = mapPatient({
      id: 'syn-patient-1',
      patientNo: 'SYN-FHIR-1',
      firstName: 'Synthetic',
      lastName: 'Fixture',
      gender: 'female',
      dateOfBirth: '1992-03-04',
      primaryPhone: '254700000001',
      identifiers: [{ type: 'national_id', value: '00000000' }],
    });
    const missing = mapPatient({
      id: 'syn-patient-bad',
      patientNo: '',
      firstName: '',
      lastName: '',
      gender: '',
      dateOfBirth: '',
    });
    return {
      sandboxConnected: false,
      validFixture: validateMappedResource(resource as unknown as Record<string, unknown>),
      missingRequired: validateMappedResource(missing as unknown as Record<string, unknown>),
    };
  }
}
