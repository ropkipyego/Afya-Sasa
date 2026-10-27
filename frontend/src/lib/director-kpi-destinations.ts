/** Canonical Director dashboard KPI → existing hospital screen. */
export const DIRECTOR_KPI_DESTINATIONS = {
  opdVisits: 'Doctor Queue',
  newPatients: 'Patient Registry',
  returningPatients: 'Doctor Queue',
  admissions: 'Inpatient (IPD)',
  discharges: 'Inpatient (IPD)',
  currentInpatients: 'Inpatient (IPD)',
  bedOccupancy: 'Inpatient (IPD)',
  labRequests: 'Laboratory',
  radiologyRequests: 'Radiology',
  emergencyCases: 'Emergency',
  appointments: 'Appointments',
  charges: 'Cashier / Billing',
  collections: 'Cashier / Billing',
  refunds: 'Cashier / Billing',
  unmatchedPayments: 'Cashier / Billing',
  outstanding: 'Cashier / Billing',
  accommodationCharges: 'Cashier / Billing',
  expiryRiskBatches: 'Products & Stock',
  pendingLabVerification: 'Laboratory',
  pendingRadiologyReports: 'Radiology',
  pendingDischarge: 'Inpatient (IPD)',
  unassignedOpd: 'Doctor Queue',
  waitingForDoctor: 'Doctor Queue',
  bedConflicts: 'Inpatient (IPD)',
} as const

export type DirectorKpiKey = keyof typeof DIRECTOR_KPI_DESTINATIONS
