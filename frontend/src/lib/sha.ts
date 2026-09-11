import { apiRequest } from './api'

export const SHA_IDENTIFICATION_TYPES = [
  'National ID',
  'ClientRegistry ID',
  'Birth Notification',
  'Birth Certificate',
  'Alien ID',
  'Refugee ID',
  'Mandate Number',
] as const

export type ShaIdentificationType = (typeof SHA_IDENTIFICATION_TYPES)[number]

export type ShaScheme = {
  schemeName?: string
  status?: string
  fund?: string
  validFrom?: string
  validTo?: string
}

export type ShaEligibilityCheck = {
  id: string
  patientId?: string | null
  identificationType: string
  identificationNumber: string
  outcome: 'eligible' | 'ineligible' | 'not_found' | 'input_error' | 'disconnected' | 'error'
  source: 'live' | 'stub' | 'disconnected'
  memberCrNumber?: string | null
  fullName?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  age?: number | null
  isAlive?: boolean | null
  whitelistedForOtp?: boolean | null
  facilityBiometricsEnforced?: boolean | null
  statusCode?: string | null
  statusDesc?: string | null
  schemes: ShaScheme[]
  pomsfEligible?: boolean
  createdAt?: string
  official?: {
    notFoundMeans: string
    ineligibleMeans: string
    eligibleMeans: string
  }
}

export type ShaStatus = {
  connected: boolean
  mode: 'live' | 'stub' | 'disconnected'
  officialSite: string
  providerPortal: string
  hieDocs: string
  baseUrl: string
  facilityFrCodeSet: boolean
  credentialsSet: boolean
  funds: { code: string; name: string; covers: string[] }[]
  identificationTypes: string[]
  nextOfficialSteps: string[]
}

export function getShaStatus() {
  return apiRequest<ShaStatus>('/sha/status')
}

export type ShaCoverage = {
  mode: 'live' | 'stub' | 'disconnected'
  liveVerificationAvailable: boolean
  identifiersOnFile: { type: string; value: string; verified?: boolean }[]
  latestCheck: {
    outcome: ShaEligibilityCheck['outcome']
    source: ShaEligibilityCheck['source']
    statusDesc?: string | null
    createdAt?: string
    schemes?: ShaScheme[]
  } | null
  verificationState: 'verified' | 'practice_only' | 'recorded' | 'unavailable' | 'not_verified'
}

export function getLatestShaEligibility(patientId: string) {
  return apiRequest<ShaEligibilityCheck | null>(`/sha/eligibility/patient/${patientId}`)
}

export function getShaCoverage(patientId: string) {
  return apiRequest<ShaCoverage>(`/sha/coverage/patient/${patientId}`)
}

export function checkShaEligibility(payload: {
  patientId?: string
  identificationType?: string
  identificationNumber?: string
}) {
  return apiRequest<ShaEligibilityCheck>('/sha/eligibility', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
