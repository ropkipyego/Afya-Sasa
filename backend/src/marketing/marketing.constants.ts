export const MARKETING_ACTIVITY_TYPES = [
  'facility_contacted',
  'individual_contact',
  'outreach_event',
  'hospital_visit',
  'doctor_clinic_visit',
  'corporate_visit',
  'community_outreach',
  'follow_up',
  'other',
] as const;

export type MarketingActivityType = (typeof MARKETING_ACTIVITY_TYPES)[number];

export const MARKETING_OUTCOMES = [
  'pending',
  'interested',
  'not_interested',
  'follow_up_scheduled',
  'referred',
  'converted',
  'no_response',
  'other',
] as const;

export type MarketingOutcome = (typeof MARKETING_OUTCOMES)[number];

export const MARKETING_PERMISSIONS = {
  read: 'marketing:read',
  create: 'marketing:create',
  update: 'marketing:update',
  delete: 'marketing:delete',
  manage: 'marketing:manage',
  reports: 'marketing:reports',
} as const;
