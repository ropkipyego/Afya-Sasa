import { getApiErrorStatus } from '../../lib/api'

export const MARKETING_ACTIVITY_TYPES = [
  { value: 'facility_contacted', label: 'Facility contacted' },
  { value: 'individual_contact', label: 'Individual contact' },
  { value: 'outreach_event', label: 'Outreach / event' },
  { value: 'hospital_visit', label: 'Hospital visit' },
  { value: 'doctor_clinic_visit', label: 'Doctor / clinic visit' },
  { value: 'corporate_visit', label: 'Corporate / organization visit' },
  { value: 'community_outreach', label: 'Community outreach' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'other', label: 'Other' },
] as const

export const MARKETING_OUTCOMES = [
  { value: 'pending', label: 'Pending' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'follow_up_scheduled', label: 'Follow-up scheduled' },
  { value: 'referred', label: 'Referred' },
  { value: 'converted', label: 'Converted' },
  { value: 'no_response', label: 'No response' },
  { value: 'other', label: 'Other' },
] as const

export type MarketingActivity = {
  id: string
  activityDate: string
  ownerUserId: string | null
  ownerName: string
  location: string | null
  facilityName: string
  contactPerson: string | null
  contactPhone: string | null
  purpose: string | null
  activityType: string
  servicesPromoted: string | null
  peopleReached: number
  leadsGenerated: number
  referralsGenerated: number
  followUpRequired: boolean
  followUpDate: string | null
  followUpCompleted: boolean
  outcome: string | null
  nextAction: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
}

export type MarketingActivityList = {
  items: MarketingActivity[]
  total: number
  page: number
  pageSize: number
}

export type MarketingPeriodTotals = {
  activities: number
  locationsVisited: number
  facilitiesContacted: number
  contactsReached: number
  peopleReached: number
  leads: number
  referrals: number
  followUpsDue: number
  followUpsCompleted: number
}

export type MarketingDashboard = {
  today: MarketingPeriodTotals
  week: MarketingPeriodTotals
  month: MarketingPeriodTotals
}

export type MarketingGroupRow = {
  key: string
  label: string
  activities: number
  peopleReached?: number
  leads?: number
  referrals?: number
}

export type MarketingTeamSummary = {
  from: string
  to: string
  totals: MarketingPeriodTotals
  byStaff: MarketingGroupRow[]
  byDate: MarketingGroupRow[]
  byLocation: MarketingGroupRow[]
  byFacility: MarketingGroupRow[]
  byActivityType: MarketingGroupRow[]
  byOutcome: MarketingGroupRow[]
  byService: MarketingGroupRow[]
  pendingFollowUps: number
  completedFollowUps: number
}

export type MarketingCatalog = {
  sites: string[]
  activities: string[]
}

export function activityTypeLabel(value: string) {
  return MARKETING_ACTIVITY_TYPES.find((item) => item.value === value)?.label ?? value
}

export function outcomeLabel(value: string | null) {
  if (!value) return '—'
  return MARKETING_OUTCOMES.find((item) => item.value === value)?.label ?? value
}

export function marketingError(error: unknown, fallback: string) {
  const status = getApiErrorStatus(error)
  const message = error instanceof Error ? error.message : fallback
  if (status === 400) return message
  if (status === 401) return 'Your session expired. Sign in again.'
  if (status === 403) return message || 'You do not have permission for this marketing action.'
  if (status === 404) return 'Marketing record was not found.'
  if (status === 409) return message
  if (status === 500 || status === 502 || status === 503) return fallback
  return message
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function totalsOf(rows: MarketingActivity[]) {
  return {
    activities: rows.length,
    locations: new Set(rows.map((row) => row.location?.trim()).filter(Boolean)).size,
    facilities: new Set(rows.map((row) => row.facilityName.trim()).filter(Boolean)).size,
    people: rows.reduce((sum, row) => sum + Number(row.peopleReached || 0), 0),
    leads: rows.reduce((sum, row) => sum + Number(row.leadsGenerated || 0), 0),
    referrals: rows.reduce((sum, row) => sum + Number(row.referralsGenerated || 0), 0),
  }
}
