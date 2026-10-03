export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  ENCOUNTER_NOT_FOUND: 'ENCOUNTER_NOT_FOUND',
  ENCOUNTER_ALREADY_OPEN: 'ENCOUNTER_ALREADY_OPEN',
  ENCOUNTER_ALREADY_CLOSED: 'ENCOUNTER_ALREADY_CLOSED',
  DOCTOR_ASSIGNMENT_CONFLICT: 'DOCTOR_ASSIGNMENT_CONFLICT',
  TRIAGE_SAVE_FAILED: 'TRIAGE_SAVE_FAILED',
  LAB_SAMPLE_NOT_FOUND: 'LAB_SAMPLE_NOT_FOUND',
  LAB_SAMPLE_PATIENT_MISMATCH: 'LAB_SAMPLE_PATIENT_MISMATCH',
  RADIOLOGY_REQUEST_NOT_FOUND: 'RADIOLOGY_REQUEST_NOT_FOUND',
  CHARGE_NOT_FOUND: 'CHARGE_NOT_FOUND',
  CHARGE_ALREADY_CREATED: 'CHARGE_ALREADY_CREATED',
  CHARGES_DISABLED: 'CHARGES_DISABLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_DUPLICATE: 'PAYMENT_DUPLICATE',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVENTORY_UPDATE_FAILED: 'INVENTORY_UPDATE_FAILED',
  BIOMETRIC_DEVICE_UNAVAILABLE: 'BIOMETRIC_DEVICE_UNAVAILABLE',
  BIOMETRIC_SDK_UNAVAILABLE: 'BIOMETRIC_SDK_UNAVAILABLE',
  BIOMETRIC_VERIFICATION_FAILED: 'BIOMETRIC_VERIFICATION_FAILED',
  BIOMETRIC_CONFLICT: 'BIOMETRIC_CONFLICT',
  BIOMETRIC_NO_MATCH: 'BIOMETRIC_NO_MATCH',
  BIOMETRIC_AMBIGUOUS: 'BIOMETRIC_AMBIGUOUS',
  EMAIL_NOT_CONFIGURED: 'EMAIL_NOT_CONFIGURED',
  SMS_NOT_CONFIGURED: 'SMS_NOT_CONFIGURED',
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',
  MARKETING_ACTIVITY_NOT_FOUND: 'MARKETING_ACTIVITY_NOT_FOUND',
  MARKETING_FOUNDATION_UNAVAILABLE: 'MARKETING_FOUNDATION_UNAVAILABLE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const MESSAGE_CODE_HINTS: Array<{ match: RegExp; code: ErrorCode }> = [
  { match: /patient not found/i, code: ERROR_CODES.PATIENT_NOT_FOUND },
  { match: /encounter not found/i, code: ERROR_CODES.ENCOUNTER_NOT_FOUND },
  { match: /already has an open opd visit/i, code: ERROR_CODES.ENCOUNTER_ALREADY_OPEN },
  { match: /already closed|cannot update a closed encounter/i, code: ERROR_CODES.ENCOUNTER_ALREADY_CLOSED },
  { match: /attending doctor|doctor assignment/i, code: ERROR_CODES.DOCTOR_ASSIGNMENT_CONFLICT },
  { match: /triage/i, code: ERROR_CODES.TRIAGE_SAVE_FAILED },
  { match: /barcode was not found|sample not found|specimen/i, code: ERROR_CODES.LAB_SAMPLE_NOT_FOUND },
  { match: /does not belong|patient mismatch/i, code: ERROR_CODES.LAB_SAMPLE_PATIENT_MISMATCH },
  { match: /radiology request not found/i, code: ERROR_CODES.RADIOLOGY_REQUEST_NOT_FOUND },
  { match: /charge not found/i, code: ERROR_CODES.CHARGE_NOT_FOUND },
  { match: /charge already|already posted/i, code: ERROR_CODES.CHARGE_ALREADY_CREATED },
  { match: /charges are disabled/i, code: ERROR_CODES.CHARGES_DISABLED },
  { match: /matching payment was just recorded/i, code: ERROR_CODES.PAYMENT_DUPLICATE },
  { match: /insufficient stock/i, code: ERROR_CODES.INSUFFICIENT_STOCK },
  { match: /inventory/i, code: ERROR_CODES.INVENTORY_UPDATE_FAILED },
  { match: /already registered to another patient|already linked to another patient/i, code: ERROR_CODES.BIOMETRIC_CONFLICT },
  { match: /sdk_unavailable|sdk is not available|hid digitalpersona sdk/i, code: ERROR_CODES.BIOMETRIC_SDK_UNAVAILABLE },
  { match: /device_disconnected|reader is unavailable|reader unavailable/i, code: ERROR_CODES.BIOMETRIC_DEVICE_UNAVAILABLE },
  { match: /no biometric match|fingerprint not recognized/i, code: ERROR_CODES.BIOMETRIC_NO_MATCH },
  { match: /multiple patients matched|multiple_candidates/i, code: ERROR_CODES.BIOMETRIC_AMBIGUOUS },
  { match: /fingerprint|biometric/i, code: ERROR_CODES.BIOMETRIC_VERIFICATION_FAILED },
  { match: /smtp|email is currently unavailable|mail is not configured/i, code: ERROR_CODES.EMAIL_NOT_CONFIGURED },
  { match: /sms.*not configured|celcom/i, code: ERROR_CODES.SMS_NOT_CONFIGURED },
  { match: /marketing activity not found/i, code: ERROR_CODES.MARKETING_ACTIVITY_NOT_FOUND },
  { match: /marketing foundation/i, code: ERROR_CODES.MARKETING_FOUNDATION_UNAVAILABLE },
];

export function inferErrorCode(status: number, message: string): ErrorCode {
  for (const hint of MESSAGE_CODE_HINTS) {
    if (hint.match.test(message)) return hint.code;
  }
  if (status === 401) return ERROR_CODES.AUTH_REQUIRED;
  if (status === 403) return ERROR_CODES.AUTH_FORBIDDEN;
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status === 409) return ERROR_CODES.CONFLICT;
  if (status === 429) return ERROR_CODES.RATE_LIMITED;
  if (status === 400 || status === 422) return ERROR_CODES.VALIDATION_ERROR;
  if (status === 502 || status === 503) return ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE;
  return ERROR_CODES.INTERNAL_ERROR;
}

export function safePublicMessage(status: number, fallback?: string): string {
  if (status === 401) return 'Authentication is required.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested record could not be found.';
  if (status === 409) return fallback?.trim() || 'This action conflicts with the current record.';
  if (status === 429) return 'Too many requests. Please wait and try again.';
  if (status === 400 || status === 422) return fallback?.trim() || 'The submitted information is not valid.';
  if (status === 502 || status === 503) {
    return 'The service is temporarily unavailable. Please retry.';
  }
  if (status >= 500) return 'The server could not complete this request.';
  return fallback?.trim() || 'The request could not be completed.';
}
