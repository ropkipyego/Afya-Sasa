export type BiometricCaptureResult =
  | 'verified'
  | 'not_verified'
  | 'no_match'
  | 'multiple_candidates'
  | 'device_error'
  | 'timeout'
  | 'cancelled'
  | 'enrolled';

export type BiometricCandidate = {
  externalSubjectId: string;
  confidence?: number;
};

export type BiometricAgentPayload = {
  deviceKey: string;
  deviceSecret?: string;
  deviceHmac?: string;
  operation: 'enroll' | 'verify' | 'identify' | 'status' | 'test';
  result: BiometricCaptureResult;
  externalSubjectId?: string;
  externalReference?: string;
  confidence?: number;
  candidates?: BiometricCandidate[];
  capturedAt?: string;
  nonce?: string;
  agentVersion?: string;
  lastError?: string;
  qualityLabel?: string;
  qualityScore?: number;
  fingerPosition?: string;
  readerState?: string;
};

export interface BiometricProvider {
  readonly providerId: string;
  validatePayload(payload: BiometricAgentPayload): BiometricAgentPayload;
  getDeviceStatus(payload: BiometricAgentPayload): {
    provider: string;
    sdk: string;
    note: string;
  };
}
