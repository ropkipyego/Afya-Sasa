import { BadRequestException } from '@nestjs/common';

export type TheatreBookingStatus =
  | 'requested'
  | 'scheduled'
  | 'pre_op'
  | 'in_theatre'
  | 'recovery'
  | 'completed'
  | 'cancelled';

export type TheatreConsentStatus = 'not_required' | 'pending' | 'signed' | 'withdrawn';
export type TheatreChecklistStatus = 'pending' | 'complete';

export function consentSatisfied(input: {
  consentStatus?: TheatreConsentStatus | null;
  priority?: 'elective' | 'urgent' | 'emergency' | string | null;
}) {
  if (input.priority === 'emergency') return true;
  return input.consentStatus === 'signed' || input.consentStatus === 'not_required';
}

export function assertMayEnterTheatre(input: {
  consentStatus?: TheatreConsentStatus | null;
  checklistStatus?: TheatreChecklistStatus | null;
  priority?: 'elective' | 'urgent' | 'emergency' | string | null;
}) {
  if (!consentSatisfied(input)) {
    throw new BadRequestException(
      'Record a signed consent note before the patient enters theatre. Emergency cases may proceed without a signed consent.',
    );
  }
  if (input.checklistStatus !== 'complete') {
    throw new BadRequestException(
      'Complete the counts / checklist note before the patient enters theatre.',
    );
  }
}

export function consentStatusAfterNote(
  type: string,
  current: TheatreConsentStatus | null | undefined,
): TheatreConsentStatus | undefined {
  if (type === 'consent') return 'signed';
  return current ?? undefined;
}

export function checklistStatusAfterNote(
  type: string,
  current: TheatreChecklistStatus | null | undefined,
): TheatreChecklistStatus | undefined {
  if (type === 'checklist') return 'complete';
  return current ?? undefined;
}
