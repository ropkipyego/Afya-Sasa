import { ModulePatientDirectory } from '../patients/ModulePatientDirectory'

export function OpdPatientsView({
  onOpenPatient,
}: {
  onOpenPatient?: (patientId: string) => void
}) {
  return (
    <ModulePatientDirectory
      title="OPD patients"
      description="Outpatients currently in clinic workflow — waiting, triaged, with doctor, or awaiting investigations."
      module="opd"
      defaultQueue="waiting"
      onOpenPatient={onOpenPatient}
      queues={[
        { key: 'waiting', label: 'Waiting' },
        { key: 'triaged', label: 'Triaged' },
        { key: 'with-doctor', label: 'With doctor' },
        { key: 'investigations-pending', label: 'Investigations' },
        { key: 'completed', label: 'Completed today' },
      ]}
    />
  )
}

export function IpdPatientsView({
  onOpenPatient,
}: {
  onOpenPatient?: (patientId: string) => void
}) {
  return (
    <ModulePatientDirectory
      title="Inpatient census"
      description="Patients currently admitted or expected for discharge — open any row for the full chart."
      module="ipd"
      defaultQueue="current-admissions"
      onOpenPatient={onOpenPatient}
      queues={[
        { key: 'current-admissions', label: 'Admitted' },
        { key: 'expected-discharges', label: 'Due discharge' },
        { key: 'critical', label: 'ICU / HDU' },
      ]}
    />
  )
}

export function EmergencyPatientsView({
  onOpenPatient,
}: {
  onOpenPatient?: (patientId: string) => void
}) {
  return (
    <ModulePatientDirectory
      title="Emergency patients"
      description="Emergency department queue by triage category and disposition."
      module="emergency"
      defaultQueue="waiting"
      onOpenPatient={onOpenPatient}
      queues={[
        { key: 'waiting', label: 'Waiting' },
        { key: 'red', label: 'Red' },
        { key: 'orange', label: 'Orange' },
        { key: 'yellow', label: 'Yellow' },
        { key: 'green', label: 'Green' },
        { key: 'observation', label: 'Observation' },
      ]}
    />
  )
}

export function LabPatientsView({
  onOpenPatient,
}: {
  onOpenPatient?: (patientId: string) => void
}) {
  return (
    <ModulePatientDirectory
      title="Laboratory patients"
      description="Patients with active laboratory requests in this department."
      module="laboratory"
      defaultQueue="requested"
      onOpenPatient={onOpenPatient}
      queues={[
        { key: 'requested', label: 'Requested' },
        { key: 'collected', label: 'Collected' },
        { key: 'processing', label: 'Processing' },
        { key: 'completed', label: 'Resulted' },
        { key: 'verified', label: 'Verified' },
      ]}
    />
  )
}

export function RadiologyPatientsView({
  onOpenPatient,
}: {
  onOpenPatient?: (patientId: string) => void
}) {
  return (
    <ModulePatientDirectory
      title="Imaging patients"
      description="Patients with radiology requests across the imaging workflow."
      module="radiology"
      defaultQueue="requested"
      onOpenPatient={onOpenPatient}
      queues={[
        { key: 'requested', label: 'Requested' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'in-progress', label: 'In progress' },
        { key: 'reported', label: 'Reported' },
      ]}
    />
  )
}
