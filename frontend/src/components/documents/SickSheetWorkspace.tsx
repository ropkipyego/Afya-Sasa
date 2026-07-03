import { useRef, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Printer } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  TextareaField,
} from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { PatientContextHeader } from '../PatientContextHeader'
import { apiRequest } from '../../lib/api'
import { useAuthStore } from '../../lib/auth-store'
import { notify } from '../../lib/notify'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { hospitalTemplateVars, printOrDownloadTemplate } from '../../lib/template-engine'

type SickSheetRow = {
  id: string
  diagnosis: string
  daysOff: number
  startDate: string
  endDate: string
  doctorName: string
  licenseNumber: string | null
  notes: string | null
  createdAt: string
  patient: { firstName: string; lastName: string; patientNo: string }
}

export function SickSheetWorkspace() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { data: catalog } = useClinicalCatalog()
  const profile = catalog?.hospitalProfile
  const printTemplates = catalog?.printTemplates
  const facilityName = profile?.facilityName ?? 'Hospital'
  const printRef = useRef<HTMLDivElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const doctorName = user ? `Dr. ${user.firstName} ${user.lastName}` : ''
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [preview, setPreview] = useState({
    diagnosis: '',
    daysOff: 1,
    startDate: today,
    endDate: today,
    doctorName,
    licenseNumber: '',
  })

  const { data: history = [] } = useQuery({
    queryKey: ['sick-sheets', selectedPatient?.id],
    queryFn: () => apiRequest<SickSheetRow[]>(`/opd/sick-sheets?patientId=${selectedPatient!.id}`),
    enabled: Boolean(selectedPatient?.id),
  })

  const createSheet = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/opd/sick-sheets', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          diagnosis: form.get('diagnosis'),
          daysOff: Number(form.get('daysOff')),
          startDate: form.get('startDate'),
          endDate: form.get('endDate'),
          doctorName: form.get('doctorName'),
          licenseNumber: form.get('licenseNumber') || undefined,
          notes: form.get('notes') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Sick sheet issued', 'Saved to patient record.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['sick-sheets'] })
    },
  })

  const printSheet = async (data: {
    patientName: string
    patientNo: string
    diagnosis: string
    daysOff: number
    startDate: string
    endDate: string
    doctorName: string
    licenseNumber: string
  }) => {
    try {
      await printOrDownloadTemplate(
        'sick_sheet',
        {
          ...hospitalTemplateVars(profile),
          patientName: data.patientName,
          patientNo: data.patientNo,
          diagnosis: data.diagnosis,
          daysOff: data.daysOff,
          startDate: data.startDate,
          endDate: data.endDate,
          doctorName: data.doctorName,
          licenseNumber: data.licenseNumber || '—',
          issuedDate: new Date().toLocaleDateString(),
        },
        printTemplates,
      )
    } catch (error) {
      notify('Print failed', (error as Error).message, 'critical')
    }
  }

  return (
    <div className="workspace-shell animate-fade-in">
      <div className="grid gap-8 xl:grid-cols-[1fr_0.85fr]">
        <Card className="p-5 md:p-8">
          <PageHeader title="Issue sick sheet" description="Generate, print, and store sick leave certificates." />
          <PatientSearchAutocomplete
            selected={selectedPatient}
            onSelect={setSelectedPatient}
          />
          {selectedPatient ? (
            <PatientContextHeader patient={selectedPatient} workflowStep="in_consultation" className="mt-6" />
          ) : null}

          <form
            id="sick-sheet-form"
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              createSheet.mutate(e.currentTarget)
            }}
            onChange={(e) => {
              const form = e.currentTarget
              const fd = new FormData(form)
              setPreview({
                diagnosis: String(fd.get('diagnosis') || ''),
                daysOff: Number(fd.get('daysOff') || 1),
                startDate: String(fd.get('startDate') || today),
                endDate: String(fd.get('endDate') || today),
                doctorName: String(fd.get('doctorName') || doctorName),
                licenseNumber: String(fd.get('licenseNumber') || ''),
              })
            }}
          >
            <Field name="diagnosis" label="Diagnosis" required />
            <Field name="daysOff" label="Days off" type="number" min={1} required defaultValue={1} />
            <Field name="startDate" label="Start date" type="date" required defaultValue={today} />
            <Field name="endDate" label="End date" type="date" required />
            <Field name="doctorName" label="Doctor" required defaultValue={doctorName} />
            <Field name="licenseNumber" label="License number" />
            <TextareaField name="notes" label="Additional notes" />
            {createSheet.isError ? (
              <Alert tone="error">{createSheet.error.message}</Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={createSheet.isPending} disabled={!selectedPatient}>
                Save sick sheet
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedPatient}
                onClick={() => {
                  const form = printRef.current?.closest('form')
                  if (!form || !selectedPatient) return
                  const fd = new FormData(form as HTMLFormElement)
                  printSheet({
                    patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                    patientNo: selectedPatient.patientNo,
                    diagnosis: String(fd.get('diagnosis') || ''),
                    daysOff: Number(fd.get('daysOff') || 1),
                    startDate: String(fd.get('startDate') || today),
                    endDate: String(fd.get('endDate') || today),
                    doctorName: String(fd.get('doctorName') || doctorName),
                    licenseNumber: String(fd.get('licenseNumber') || ''),
                  })
                }}
              >
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
            </div>
          </form>
          <div ref={printRef} className="hidden" />
        </Card>

        <div className="space-y-6">
          <Card className="p-5 md:p-8">
            <PageHeader title="Live preview" description="Certificate as it will print." />
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-inner">
              <div className="border-b border-teal-700 pb-4 text-center">
                <p className="text-lg font-bold text-teal-800">{facilityName}</p>
                <p className="text-sm font-semibold text-slate-600">Medical Certificate / Sick Sheet</p>
              </div>
              {selectedPatient ? (
                <div className="mt-6 space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Patient:</strong> {selectedPatient.firstName} {selectedPatient.lastName} (
                    {selectedPatient.patientNo})
                  </p>
                  <p>
                    <strong>Diagnosis:</strong> {preview.diagnosis || '—'}
                  </p>
                  <p>
                    <strong>Period:</strong> {preview.startDate || today} → {preview.endDate || today} (
                    {preview.daysOff} days)
                  </p>
                  <p className="text-slate-600">
                    This certifies the patient is unfit for work/school during the stated period.
                  </p>
                  <div className="mt-8 flex justify-between border-t border-dashed border-slate-200 pt-6 text-xs">
                    <div>
                      <p>
                        <strong>Doctor:</strong> {preview.doctorName || doctorName || '—'}
                      </p>
                      <p>
                        <strong>License:</strong> {preview.licenseNumber || '—'}
                      </p>
                    </div>
                    <div className="rounded border border-dashed border-slate-300 px-6 py-4 text-slate-400">
                      Stamp
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">Select a patient to preview.</p>
              )}
            </div>
          </Card>

          <Card className="p-5 md:p-8">
            <PageHeader title="Sick sheet history" description="Previously issued certificates." />
            <div className="mt-6 space-y-3">
              {history.map((sheet) => (
                <div key={sheet.id} className="card-hover rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{sheet.diagnosis}</p>
                    <p className="text-xs text-slate-500">
                      {sheet.startDate} → {sheet.endDate} · {sheet.daysOff} days
                    </p>
                    <p className="text-sm text-slate-600">Dr. {sheet.doctorName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() =>
                      printSheet({
                        patientName: `${sheet.patient.firstName} ${sheet.patient.lastName}`,
                        patientNo: sheet.patient.patientNo,
                        diagnosis: sheet.diagnosis,
                        daysOff: sheet.daysOff,
                        startDate: sheet.startDate,
                        endDate: sheet.endDate,
                        doctorName: sheet.doctorName,
                        licenseNumber: sheet.licenseNumber ?? '',
                      })
                    }
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Reprint
                  </Button>
                </div>
              </div>
            ))}
            {!history.length ? (
              <p className="py-8 text-center text-sm text-slate-500">No sick sheets on record.</p>
            ) : null}
          </div>
        </Card>
        </div>
      </div>
    </div>
  )
}
