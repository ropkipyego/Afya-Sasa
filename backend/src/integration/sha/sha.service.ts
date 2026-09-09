import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../../common/request-context';
import { Patient, PatientIdentifier } from '../../patients/patient.entities';
import { ShaClient, type ShaEligibilityApiResponse } from './sha.client';
import { CheckShaEligibilityDto } from './sha.dto';
import {
  ShaEligibilityCheck,
  type ShaCheckOutcome,
  type ShaCheckSource,
  type ShaScheme,
} from './sha.entities';
import {
  inferShaFund,
  isPomsfScheme,
  toShaIdentificationType,
  type ShaIdentificationType,
} from './sha.types';

const IDENTIFIER_PRIORITY = [
  'client_registry',
  'national_id',
  'birth_certificate',
  'alien_id',
  'refugee_id',
  'birth_notification',
  'mandate_number',
];

@Injectable()
export class ShaService {
  constructor(
    private readonly config: ConfigService,
    private readonly client: ShaClient,
    @InjectRepository(ShaEligibilityCheck)
    private readonly checks: Repository<ShaEligibilityCheck>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(PatientIdentifier)
    private readonly identifiers: Repository<PatientIdentifier>,
  ) {}

  status() {
    const mode = this.resolvedMode();
    return {
      connected: mode === 'live',
      mode,
      officialSite: 'https://sha.go.ke',
      providerPortal: 'https://portal.sha.go.ke',
      hieDocs: 'https://hie-docs.dha.go.ke/docs/claims/process/eligibility/eligibilityCheck',
      baseUrl: this.client.baseUrl,
      facilityFrCodeSet: Boolean(this.client.facilityFrCode),
      credentialsSet: Boolean(this.client.clientId && this.client.clientSecret),
      funds: [
        {
          code: 'PHF',
          name: 'Primary Healthcare Fund',
          covers: [
            'Outpatient care',
            'Maternity, newborn and child health',
            'Cancer screening',
            'Optical',
            'End-of-life services',
          ],
        },
        {
          code: 'SHIF',
          name: 'Social Health Insurance Fund',
          covers: [
            'Inpatient care',
            'Maternity and neonatal',
            'Renal care',
            'Mental health',
            'Surgical services',
          ],
        },
        {
          code: 'ECCIF',
          name: 'Emergency, Chronic & Critical Illness Fund',
          covers: [
            'Ambulance evacuation',
            'Accident and emergency',
            'Critical illness',
            'Palliative care',
            'Chronic illnesses',
          ],
        },
      ],
      identificationTypes: [
        'National ID',
        'ClientRegistry ID',
        'Birth Notification',
        'Birth Certificate',
        'Alien ID',
        'Refugee ID',
        'Mandate Number',
      ],
      nextOfficialSteps: [
        'Eligibility check (this screen)',
        'Biometric consent on the HealthID workstation, or OTP if SHA has whitelisted the patient',
        'Start visit on the SHA HIE',
        'Submit or discharge the claim from portal.sha.go.ke / HIE — not typed as cash',
      ],
    };
  }

  async latestForPatient(patientId: string) {
    await this.ensurePatient(patientId);
    return this.checks.findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async check(dto: CheckShaEligibilityDto, request: RequestContext) {
    const resolved = await this.resolveIdentity(dto);
    const mode = this.resolvedMode();
    if (mode === 'disconnected') {
      throw new ServiceUnavailableException(
        'SHA HIE is not connected. Set SHA_CLIENT_ID, SHA_CLIENT_SECRET, and SHA_FACILITY_FR_CODE, then ask SHA/DHA for facility credentials. Until then use portal.sha.go.ke for live checks.',
      );
    }

    let outcome: ShaCheckOutcome;
    let source: ShaCheckSource;
    let api: ShaEligibilityApiResponse = {};

    if (mode === 'stub') {
      source = 'stub';
      api = this.stubResponse(resolved.identificationType, resolved.identificationNumber);
      outcome = this.outcomeFromApi(api);
    } else {
      source = 'live';
      try {
        api = await this.client.checkEligibility(
          resolved.identificationType,
          resolved.identificationNumber,
        );
        outcome = this.outcomeFromApi(api);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'SHA eligibility request failed';
        if (/not found|no patient|404/i.test(message)) {
          outcome = 'not_found';
          api = { statusDesc: message };
        } else if (/400|invalid|missing/i.test(message)) {
          outcome = 'input_error';
          api = { statusDesc: message };
        } else {
          throw new BadRequestException(message);
        }
      }
    }

    const schemes = this.normalizeSchemes(api.schemes);
    const saved = await this.checks.save(
      this.checks.create({
        patientId: resolved.patientId,
        identificationType: resolved.identificationType,
        identificationNumber: resolved.identificationNumber,
        outcome,
        source,
        memberCrNumber: api.memberCrNumber ?? null,
        fullName: api.fullName ?? null,
        dateOfBirth: api.dateOfBirth ?? null,
        gender: api.gender ?? null,
        age: api.age ?? null,
        isAlive: api.isAlive ?? null,
        whitelistedForOtp: api.whitelistedForOTP ?? null,
        facilityBiometricsEnforced: api.facilityBiometricsEnforced ?? null,
        statusCode: api.statusCode ?? null,
        statusDesc: api.statusDesc ?? null,
        schemes,
        pomsfEligible: schemes.some((row) => isPomsfScheme(row.schemeName)),
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    if (resolved.patientId && api.memberCrNumber && outcome !== 'not_found') {
      await this.rememberCrId(resolved.patientId, api.memberCrNumber, request);
    }

    return {
      ...saved,
      official: {
        notFoundMeans: 'Identity was not in the SHA Client Registry — correct the ID, do not treat as unpaid.',
        ineligibleMeans:
          'The person was found, but SHA contributions are not active. Bill cash/other cover, or send them to register/pay at sha.go.ke.',
        eligibleMeans:
          'Coverage is active. Start a SHA visit only after biometric/OTP consent. Do not invent a consultation fee as SHA reimbursement.',
      },
    };
  }

  private resolvedMode(): 'live' | 'stub' | 'disconnected' {
    const requested = (this.config.get<string>('SHA_MODE') ?? 'auto').toLowerCase();
    if (requested === 'stub') return 'stub';
    if (requested === 'off' || requested === 'disabled') return 'disconnected';
    if (this.client.credentialsReady()) return 'live';
    if (requested === 'live') return 'disconnected';
    return 'disconnected';
  }

  private async resolveIdentity(dto: CheckShaEligibilityDto) {
    let identificationType = toShaIdentificationType(dto.identificationType);
    let identificationNumber = dto.identificationNumber?.trim() ?? '';
    let patientId = dto.patientId ?? null;

    if (patientId) {
      const patient = await this.ensurePatient(patientId);
      if (!identificationNumber) {
        const picked = this.pickStoredIdentifier(patient.identifiers ?? []);
        if (!picked) {
          throw new BadRequestException(
            'This patient has no SHA-usable ID. Capture National ID, birth certificate, Alien ID, or Refugee ID first.',
          );
        }
        identificationType = picked.type;
        identificationNumber = picked.value;
      }
    }

    if (!identificationType) {
      throw new BadRequestException(
        'Use a SHA Client Registry type: National ID, Client Registry ID, birth notification/certificate, Alien ID, Refugee ID, or Mandate Number. Passport is not accepted by SHA eligibility.',
      );
    }
    if (!identificationNumber) {
      throw new BadRequestException('Enter the identification number for the SHA eligibility check.');
    }

    return { patientId, identificationType, identificationNumber };
  }

  private pickStoredIdentifier(rows: PatientIdentifier[]) {
    for (const type of IDENTIFIER_PRIORITY) {
      const match = rows.find((row) => row.type === type && row.value?.trim());
      if (match) {
        const mapped = toShaIdentificationType(match.type);
        if (mapped) return { type: mapped, value: match.value.trim() };
      }
    }
    return null;
  }

  private async ensurePatient(id: string) {
    const patient = await this.patients.findOne({
      where: { id },
      relations: { identifiers: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  private async rememberCrId(patientId: string, crId: string, request: RequestContext) {
    const existing = await this.identifiers.findOne({
      where: { patient: { id: patientId }, type: 'client_registry' },
    });
    if (existing) {
      existing.value = crId;
      existing.verified = true;
      existing.updatedBy = request.user?.sub ?? null;
      await this.identifiers.save(existing);
      return;
    }
    await this.identifiers.save(
      this.identifiers.create({
        patient: { id: patientId } as Patient,
        type: 'client_registry',
        value: crId,
        verified: true,
        isPrimary: false,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  private outcomeFromApi(api: ShaEligibilityApiResponse): ShaCheckOutcome {
    const code = `${api.statusCode ?? ''} ${api.statusDesc ?? ''}`.toLowerCase();
    if (api.isAlive === false) return 'ineligible';
    if (/not found|no match|unknown patient/.test(code)) return 'not_found';
    if (/ineligible|inactive|lapsed|not active|non.?compliant|unpaid/.test(code)) {
      return 'ineligible';
    }
    const schemes = api.schemes ?? [];
    if (schemes.some((row) => /active|eligible|compliant/i.test(String(row.status ?? '')))) {
      return 'eligible';
    }
    if (schemes.length && api.memberCrNumber) return 'eligible';
    if (api.memberCrNumber && api.fullName) return 'eligible';
    if (api.statusCode && !/00|200|ok|success/i.test(String(api.statusCode))) {
      return 'ineligible';
    }
    return schemes.length ? 'eligible' : 'ineligible';
  }

  private normalizeSchemes(schemes?: ShaEligibilityApiResponse['schemes']): ShaScheme[] {
    return (schemes ?? []).map((row) => ({
      schemeName: row.schemeName,
      status: row.status,
      fund: row.fund || inferShaFund(row.schemeName),
      validFrom: row.validFrom,
      validTo: row.validTo,
    }));
  }

  private stubResponse(
    type: ShaIdentificationType,
    number: string,
  ): ShaEligibilityApiResponse {
    if (number === '00000000') {
      return { statusCode: '404', statusDesc: 'Patient not found in Client Registry' };
    }
    if (number === '11111111') {
      return {
        fullName: 'Practice Patient (inactive)',
        memberCrNumber: 'CR-STUB-INACTIVE',
        isAlive: true,
        statusCode: 'INACTIVE',
        statusDesc: 'Contribution not compliant',
        schemes: [{ schemeName: 'SHIF', status: 'inactive', fund: 'SHIF' }],
      };
    }
    return {
      fullName: 'Practice Patient (active)',
      dateOfBirth: '1990-01-15',
      gender: 'female',
      age: 36,
      memberCrNumber: `CR-STUB-${number}`,
      isAlive: true,
      whitelistedForOTP: false,
      facilityBiometricsEnforced: true,
      statusCode: 'ACTIVE',
      statusDesc: 'Active SHA coverage',
      schemes: [
        { schemeName: 'UHC', status: 'active', fund: 'PHF' },
        { schemeName: 'SHIF', status: 'active', fund: 'SHIF' },
        { schemeName: 'ECCIF', status: 'active', fund: 'ECCIF' },
      ],
      requestIdNumber: number,
      requestIdType: type,
    };
  }
}
