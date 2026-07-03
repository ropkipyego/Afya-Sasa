import { useMemo, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Send } from 'lucide-react'
import clsx from 'clsx'
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  SelectField,
  TextareaField,
} from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { doctorSelectOptions } from '../../lib/clinical-catalog'
import { hospitalTemplateVars, printOrDownloadTemplate } from '../../lib/template-engine'

type ReferralRow = {
  id: string
  type: string
  status: string
  reason: string
  letter: string
  targetDepartment: string | null
  targetFacility: string | null
  createdAt: string
  patient: { id: string; firstName: string; lastName: string; patientNo: string }
  receivingUser?: { firstName: string; lastName: string } | null
}

const types = [
  { value: 'internal', label: 'Internal referral' },
  { value: 'external', label: 'External referral' },
]

const statuses = ['draft', 'sent', 'accepted', 'completed', 'cancelled'] as const

const statusTone: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-sky-50 text-sky-800',
  accepted: 'bg-teal-50 text-teal-800',
  completed: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-red-50 text-red-800',
}

export function ReferralWorkspace() {
  const queryClient = useQueryClient()
  const { data: catalog } = useClinicalCatalog()
  const profile = catalog?.hospitalProfile
  const printTemplates = catalog?.printTemplates
  const doctors = doctorSelectOptions(catalog)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => apiRequest<ReferralRow[]>('/referrals'),
  })

  const printReferralLetter = async (referral: ReferralRow) => {
    try {
      await printOrDownloadTemplate(
        'referral_letter',
        {
          ...hospitalTemplateVars(profile),
          patientName: `${referral.patient.firstName} ${referral.patient.lastName}`,
          patientNo: referral.patient.patientNo,
          referralType: referral.type,
          referralStatus: referral.status,
          targetDepartmentLine: referral.targetDepartment
            ? `Department: ${referral.targetDepartment}`
            : '',
          targetFacilityLine: referral.targetFacility ? `Facility: ${referral.targetFacility}` : '',
          reason: referral.reason,
          letterBody: referral.letter,
        },
        printTemplates,
      )
    } catch (error) {
      notify('Print failed', (error as Error).message, 'critical')
    }
  }

  const createReferral = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          encounterId: form.get('encounterId') || undefined,
          type: form.get('type'),
          receivingUserId: form.get('receivingUserId') || undefined,
          targetDepartment: form.get('targetDepartment') || undefined,
          targetFacility: form.get('targetFacility') || undefined,
          reason: form.get('reason'),
          letter: form.get('letter'),
          urgency: form.get('urgency') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Referral created', 'Referral saved to patient record.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['referrals'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/referrals/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['referrals'] })
    },
  })

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? referrals
        : referrals.filter((r) => r.status === statusFilter),
    [referrals, statusFilter],
  )

  return (
    <div className="workspace-shell animate-fade-in">
      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5 md:p-8">
          <PageHeader
            title="New referral"
            description="Clinical summary, diagnosis, urgency, and receiving clinician."
          />
          <form
            className="mt-8 space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              createReferral.mutate(event.currentTarget)
            }}
          >
            <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
            <SelectField name="type" label="Referral type" required>
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>
            <SelectField name="urgency" label="Urgency">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </SelectField>
            <SelectField name="receivingUserId" label="Receiving doctor">
              <option value="">Not specified</option>
              {doctors.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </SelectField>
            <Field name="targetDepartment" label="Receiving department" />
            <Field name="targetFacility" label="Receiving facility" />
            <TextareaField name="reason" label="Reason for referral" required />
            <TextareaField
              name="letter"
              label="Clinical summary / referral letter"
              placeholder="Diagnosis, findings, investigations, treatment given..."
              required
            />
            {createReferral.isError ? (
              <Alert tone="error">{createReferral.error.message}</Alert>
            ) : null}
            <Button type="submit" loading={createReferral.isPending} disabled={!selectedPatient}>
              Save referral
            </Button>
          </form>
        </Card>

        <Card className="p-5 md:p-8">
          <PageHeader title="Referral workspace" description="Track status from draft to closed." />
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold',
                statusFilter === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              All
            </button>
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold capitalize',
                  statusFilter === s ? 'bg-teal-600 text-white' : statusTone[s],
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-skeleton rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {filtered.map((referral) => (
                <div
                  key={referral.id}
                    className="card-hover rounded-2xl border border-slate-200 p-5 md:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {referral.patient.firstName} {referral.patient.lastName}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {referral.type} · {referral.reason.slice(0, 80)}
                      </p>
                    </div>
                    <span className={clsx('rounded-full px-3 py-1 text-xs font-bold capitalize', statusTone[referral.status])}>
                      {referral.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={() => printReferralLetter(referral)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      PDF / Print
                    </Button>
                    {referral.status === 'draft' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => updateStatus.mutate({ id: referral.id, status: 'sent' })}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </Button>
                    ) : null}
                    {referral.status === 'sent' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => updateStatus.mutate({ id: referral.id, status: 'accepted' })}
                      >
                        Mark accepted
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!filtered.length ? (
                <p className="py-12 text-center text-sm text-slate-500">No referrals found.</p>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
