import { Card, PageHeader } from '../../ui'

const ROLE_GUIDELINES = [
  {
    role: 'Reception / Records',
    can: ['Registration', 'Appointments', 'Patient search', 'Patient card printing'],
    cannot: ['Diagnosis', 'Prescriptions', 'Lab results', 'Clinical notes'],
  },
  {
    role: 'Triage nurse',
    can: ['Queue', 'Vitals', 'Triage notes', 'Emergency categories'],
    cannot: ['Diagnose', 'Prescribe', 'Discharge'],
  },
  {
    role: 'Ward nurse',
    can: ['Vitals', 'Nursing notes', 'Medication administration', 'Fluid balance', 'Care plans'],
    cannot: ['Change diagnoses', 'Prescribe medication'],
  },
  {
    role: 'Doctor',
    can: [
      'Consultation',
      'Diagnosis',
      'Orders',
      'Admissions',
      'Discharges',
      'Referrals',
      'Medical certificates',
      'Lab & radiology requests',
    ],
    cannot: ['Manage users', 'System settings'],
  },
  {
    role: 'Laboratory officer',
    can: ['Receive requests', 'Collect samples', 'Enter results', 'Upload attachments'],
    cannot: ['Verify critical results (senior role)', 'Manage catalog (senior role)'],
  },
  {
    role: 'Radiographer / Radiologist',
    can: ['Receive requests', 'Upload images/PDFs', 'Interpret and approve reports'],
    cannot: ['Manage hospital configuration'],
  },
  {
    role: 'Administrator',
    can: [
      'Hospital configuration',
      'Clinical catalog',
      'Departments',
      'Wards',
      'Users',
      'Templates',
      'Reports',
      'Audit logs',
    ],
    cannot: [],
  },
]

export function SecurityCompliancePanel() {
  return (
    <Card className="p-8">
      <PageHeader
        title="Security & role guidelines"
        description="Reference for how each role should use AfyaSasa — configure exact permissions in Roles & permissions."
      />
      <div className="mt-8 space-y-4">
        {ROLE_GUIDELINES.map((item) => (
          <div key={item.role} className="rounded-2xl border border-slate-200 p-5">
            <p className="font-bold text-slate-900">{item.role}</p>
            <p className="mt-2 text-sm text-emerald-800">
              <span className="font-semibold">Can: </span>
              {item.can.join(' · ')}
            </p>
            {item.cannot.length ? (
              <p className="mt-1 text-sm text-red-800">
                <span className="font-semibold">Cannot: </span>
                {item.cannot.join(' · ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  )
}
