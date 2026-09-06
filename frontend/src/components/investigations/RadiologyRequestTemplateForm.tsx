import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { FileUp, Printer } from 'lucide-react'
import { Alert, Button, Field, TextareaField } from '../ui'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { normalizeClinicalCatalog } from '../../lib/clinical-catalog'
import { resolveHospitalBranding } from '../../lib/hospital-configuration'
import {
  JALARAM_EXAM_TYPES,
  type JalaramImagingRequestPrintData,
} from '../../lib/jalaram-imaging-request'
import { printJalaramImagingRequest } from '../../lib/print-radiology-request'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { uploadClinicalFile } from '../../lib/clinical-upload'
import { PaymentCheckoutPanel } from '../payments/PaymentCheckoutPanel'

type RadiologyModality = { id: string; name: string; code: string }

export type RadiologyRequestContext = {
  patientId: string
  patientName: string
  patientNo?: string
  dateOfBirth?: string
  gender?: string
  patientPhone?: string | null
  encounterId?: string | null
  admissionId?: string | null
}

function ageLabel(dateOfBirth?: string) {
  if (!dateOfBirth) return '—'
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return '—'
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) years -= 1
  return years >= 0 ? String(years) : '—'
}

function genderLabel(gender?: string) {
  const g = (gender ?? '').toLowerCase()
  if (g === 'male' || g === 'm') return 'Male'
  if (g === 'female' || g === 'f') return 'Female'
  return gender ?? '—'
}

function resolveModalityId(selectedExams: string[], modalities: RadiologyModality[]) {
  for (const examKey of selectedExams) {
    const exam = JALARAM_EXAM_TYPES.find((row) => row.key === examKey)
    if (!exam) continue
    for (const code of exam.matchCodes) {
      const match = modalities.find(
        (m) =>
          m.code.toUpperCase() === code ||
          m.name.toUpperCase().replace(/\s+/g, '') === code.replace(/-/g, ''),
      )
      if (match) return match.id
    }
    const nameMatch = modalities.find((m) =>
      m.name.toUpperCase().includes(exam.label.split(' ')[0] ?? ''),
    )
    if (nameMatch) return nameMatch.id
  }
  return modalities[0]?.id ?? null
}

function FacilityTitle({ name, primary, accent }: { name: string; primary: string; accent: string }) {
  const upper = name.toUpperCase()
  if (upper.includes('JALARAM') && upper.includes('CHRISTOPHER')) {
    const parts = name.split(/\s+ST\.?\s+/i)
    if (parts.length >= 2) {
      return (
        <p className="text-center text-lg font-extrabold uppercase tracking-wide md:text-xl">
          <span style={{ color: primary }}>Jalaram</span>{' '}
          <span style={{ color: accent }}>St. {parts[1]}</span>
        </p>
      )
    }
  }
  return (
    <p className="text-center text-lg font-extrabold uppercase tracking-wide md:text-xl" style={{ color: primary }}>
      {name}
    </p>
  )
}

function FormSection({
  title,
  tone = 'blue',
  headerColor = '#1e4d8c',
  children,
  className,
}: {
  title: string
  tone?: 'blue' | 'pink'
  headerColor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx(
        'overflow-hidden rounded-xl border',
        tone === 'pink' ? 'border-rose-200 bg-rose-50/60' : 'border-sky-200 bg-white',
        className,
      )}
    >
      <div
        className={clsx(
          'px-4 py-2 text-xs font-bold uppercase tracking-widest text-white',
          tone === 'pink' ? 'bg-rose-500' : '',
        )}
        style={tone === 'pink' ? undefined : { backgroundColor: headerColor }}
      >
        {title}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-sky-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

export function RadiologyRequestTemplateForm({
  context,
  onSuccess,
  showPaymentStep = true,
}: {
  context: RadiologyRequestContext
  onSuccess?: () => void
  showPaymentStep?: boolean
}) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: rawCatalog } = useClinicalCatalog()
  const catalog = normalizeClinicalCatalog(rawCatalog)
  const brand = resolveHospitalBranding(catalog)
  const profile = catalog.hospitalProfile ?? {}

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [examTypes, setExamTypes] = useState<string[]>([])
  const [requestedInvestigation, setRequestedInvestigation] = useState('')
  const [urgencyUrgent, setUrgencyUrgent] = useState<boolean | null>(null)
  const [contrastAllergy, setContrastAllergy] = useState(false)
  const [kidneyLiverDisease, setKidneyLiverDisease] = useState(false)
  const [vitallyUnstable, setVitallyUnstable] = useState(false)
  const [requiresOxygen, setRequiresOxygen] = useState(false)
  const [lmp, setLmp] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [briefHistory, setBriefHistory] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [facilityName, setFacilityName] = useState(profile.facilityName ?? '')
  const [doctorPhone, setDoctorPhone] = useState('')

  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null)
  const [createdRequestNo, setCreatedRequestNo] = useState<string | null>(null)
  const [createdSummary, setCreatedSummary] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const primaryColor = brand.primaryColor ?? '#1e4d8c'
  const accentColor = brand.accentColor ?? '#c41e3a'

  const buildPrintData = (requestNo?: string | null): JalaramImagingRequestPrintData => ({
    requestNo,
    requestDate: today,
    patientName: context.patientName,
    patientNo: context.patientNo,
    age: ageLabel(context.dateOfBirth),
    gender: genderLabel(context.gender),
    lmp: lmp.trim() || null,
    examTypes,
    requestedInvestigation: requestedInvestigation.trim() || null,
    urgencyUrgent: urgencyUrgent === true,
    generalInformation: {
      contrastAllergy,
      kidneyLiverDisease,
      vitallyUnstable,
      requiresOxygen,
    },
    diagnosis,
    briefHistory,
    doctorName,
    facilityName: facilityName.trim() || null,
    doctorPhone: doctorPhone.trim() || null,
    branding: {
      facilityName: profile.facilityName ?? 'Hospital',
      tagline: profile.tagline ?? 'Caring Hearts Healing Hands',
      primaryColor,
      accentColor,
      logoUrl: profile.logoUrl,
      contactPhone: profile.contactPhone ?? undefined,
      contactEmail: profile.contactEmail ?? undefined,
      address: profile.physicalAddress ?? profile.address ?? undefined,
      website: profile.website ?? undefined,
    },
  })

  const handlePrint = (requestNo?: string | null) => {
    if (urgencyUrgent === null) {
      notify('Complete urgency field', 'Select Yes or No for urgent investigation before printing.', 'warning')
      return
    }
    printJalaramImagingRequest(buildPrintData(requestNo))
  }

  const { data: modalities = [] } = useQuery({
    queryKey: ['clinical-order-modalities'],
    queryFn: () => apiRequest<RadiologyModality[]>('/radiology/modalities'),
  })

  const toggleExam = (key: string) => {
    setExamTypes((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    )
  }

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!examTypes.length && !requestedInvestigation.trim()) {
        throw new Error('Select at least one examination type or describe the requested investigation.')
      }
      if (urgencyUrgent === null) {
        throw new Error('Indicate whether the investigation is urgent (RTA / pulmonary embolism, etc.).')
      }
      if (!diagnosis.trim() || !briefHistory.trim()) {
        throw new Error('Diagnosis and brief history are required.')
      }
      if (!doctorName.trim()) {
        throw new Error('Enter the referring doctor name.')
      }

      const modalityId = resolveModalityId(examTypes, modalities)
      if (!modalityId) {
        throw new Error(
          'No imaging modality configured. Add CT, X-Ray, Ultrasound, etc. in Control Center → Radiology.',
        )
      }

      const examLabels = examTypes
        .map((key) => JALARAM_EXAM_TYPES.find((e) => e.key === key)?.label)
        .filter(Boolean)
      const bodyPart = requestedInvestigation.trim() || examLabels.join(', ') || 'As requested'
      const priority = urgencyUrgent ? 'stat' : vitallyUnstable ? 'urgent' : 'routine'

      const requestFormData = {
        formTemplate: 'jalaram_imaging_request_v1',
        requestDate: today,
        examTypes,
        examLabels,
        requestedInvestigation: requestedInvestigation.trim() || null,
        urgencyUrgent,
        lmp: lmp.trim() || null,
        generalInformation: {
          contrastAllergy,
          kidneyLiverDisease,
          vitallyUnstable,
          requiresOxygen,
        },
        diagnosis: diagnosis.trim(),
        briefHistory: briefHistory.trim(),
        doctorName: doctorName.trim(),
        facilityName: facilityName.trim() || null,
        doctorPhone: doctorPhone.trim() || null,
        patientSnapshot: {
          name: context.patientName,
          age: ageLabel(context.dateOfBirth),
          gender: genderLabel(context.gender),
          patientNo: context.patientNo ?? null,
        },
      }

      const clinicalIndication = [
        diagnosis.trim(),
        briefHistory.trim() ? `History: ${briefHistory.trim()}` : '',
        examLabels.length ? `Examinations: ${examLabels.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      return apiRequest<{ id: string; requestNo?: string; modality?: { name: string }; bodyPart: string }>(
        '/radiology/requests',
        {
          method: 'POST',
          body: JSON.stringify({
            patientId: context.patientId,
            encounterId: context.encounterId || undefined,
            admissionId: context.admissionId || undefined,
            modalityId,
            bodyPart,
            clinicalIndication,
            referringClinician: doctorName.trim(),
            priority,
            requestFormData,
          }),
        },
      )
    },
    onSuccess: async (request) => {
      setCreatedRequestId(request.id)
      setCreatedRequestNo(request.requestNo ?? null)
      setCreatedSummary(
        `${request.modality?.name ?? 'Imaging'} — ${request.bodyPart}${request.requestNo ? ` (${request.requestNo})` : ''}`,
      )
      notify('Imaging request saved', `${context.patientName} — on radiology worklist.`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['radiology-requests'] })
      if (!showPaymentStep) onSuccess?.()
    },
    onError: (error: Error) => notify('Request failed', error.message, 'critical'),
  })

  const attachReferral = async (file: File) => {
    if (!createdRequestId) return
    setUploading(true)
    try {
      const uploaded = await uploadClinicalFile(file, 'radiology', createdRequestId)
      await apiRequest(`/radiology/requests/${createdRequestId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storagePath: uploaded.storagePath,
        }),
      })
      notify('Document attached', 'File linked to this imaging request.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['radiology-requests'] })
    } catch (error) {
      notify('Upload failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
    }
  }

  if (createdRequestId && showPaymentStep) {
    return (
      <div className="space-y-6">
        <Alert tone="success">
          Jalaram imaging request saved{createdRequestNo ? ` — #${createdRequestNo}` : ''}. Collect payment,
          then attach a signed paper copy if one exists.
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handlePrint(createdRequestNo)}
          >
            <Printer className="h-4 w-4" />
            Print request form
          </Button>
        </div>
        <PaymentCheckoutPanel
          patientId={context.patientId}
          patientPhone={context.patientPhone}
          serviceLine="radiology"
          serviceEntityId={createdRequestId}
          encounterId={context.encounterId ?? undefined}
          serviceDescription={createdSummary ?? 'Radiology imaging study'}
          submitLabel="Send M-Pesa STK / record payment"
          onSuccess={() => onSuccess?.()}
        />
        <div className="rounded-2xl border border-dashed border-sky-300 bg-sky-50/50 p-5">
          <p className="text-sm font-semibold text-sky-900">Attach signed referral (optional)</p>
          <p className="mt-1 text-xs text-slate-600">
            The online form replaces the paper request. Attach a scanned signed copy or external referral
            letter if your workflow requires it on file.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileUp className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Attach PDF / image'}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await attachReferral(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <Button type="button" variant="secondary" onClick={() => onSuccess?.()}>
          Done — return to worklist
        </Button>
      </div>
    )
  }

  const showLmp = genderLabel(context.gender) === 'Female'

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
      {/* Header — mirrors paper form */}
      <div className="border-b border-sky-100 bg-gradient-to-r from-white via-sky-50/80 to-white px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt=""
                className="h-16 w-16 object-contain md:h-20 md:w-20"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl text-white shadow-md md:h-20 md:w-20"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
              >
                ✚
              </div>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <FacilityTitle
                name={profile.facilityName ?? 'Imaging Request Form'}
                primary={primaryColor}
                accent={accentColor}
              />
            </div>
          </div>
          <div
            className="rounded-lg px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {profile.tagline ?? 'Caring Hearts Healing Hands'}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold text-sky-900">Date: </span>
            <span className="rounded bg-sky-50 px-3 py-1 font-medium text-slate-800">{today}</span>
          </div>
          <Button type="button" variant="secondary" onClick={() => handlePrint()}>
            <Printer className="h-4 w-4" />
            Print draft
          </Button>
        </div>
      </div>

      <form
        className="space-y-5 p-4 md:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          createRequest.mutate()
        }}
      >
        <FormSection title="Patient details" headerColor={primaryColor}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-bold uppercase text-sky-800">Full name</p>
              <div className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm font-semibold text-slate-900">
                {context.patientName}
                {context.patientNo ? (
                  <span className="ml-2 font-normal text-slate-500">({context.patientNo})</span>
                ) : null}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-sky-800">Age</p>
              <div className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                {ageLabel(context.dateOfBirth)}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-sky-800">Gender</p>
              <div className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                {genderLabel(context.gender)}
              </div>
            </div>
            {showLmp ? (
              <div className="md:col-span-2">
                <Field
                  name="lmp"
                  label="LMP (Last Menstrual Period)"
                  value={lmp}
                  onChange={(e) => setLmp(e.target.value)}
                  placeholder="e.g. 2026-01-15 or N/A"
                />
              </div>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Type of examination" headerColor={primaryColor}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {JALARAM_EXAM_TYPES.map((exam) => (
              <CheckboxRow
                key={exam.key}
                label={exam.label}
                checked={examTypes.includes(exam.key)}
                onChange={() => toggleExam(exam.key)}
              />
            ))}
          </div>
          <Field
            name="requestedInvestigation"
            label="Requested investigation"
            value={requestedInvestigation}
            onChange={(e) => setRequestedInvestigation(e.target.value)}
            placeholder="Specific study, region, or protocol (e.g. Chest PA & lateral)"
          />
        </FormSection>

        <FormSection title="Urgency & general information" headerColor={primaryColor}>
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
            <p className="text-sm font-medium text-slate-800">
              Is the investigation so urgent? (e.g. RTA or pulmonary embolism)
            </p>
            <div className="mt-2 flex gap-6">
              <CheckboxRow
                label="Yes"
                checked={urgencyUrgent === true}
                onChange={() => setUrgencyUrgent(true)}
              />
              <CheckboxRow
                label="No"
                checked={urgencyUrgent === false}
                onChange={() => setUrgencyUrgent(false)}
              />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">General information</p>
          <div className="grid gap-1 sm:grid-cols-2">
            <CheckboxRow
              label="The patient is allergic to contrast"
              checked={contrastAllergy}
              onChange={setContrastAllergy}
            />
            <CheckboxRow
              label="Patient has kidney or liver disease"
              checked={kidneyLiverDisease}
              onChange={setKidneyLiverDisease}
            />
            <CheckboxRow
              label="Patient vitally unstable"
              checked={vitallyUnstable}
              onChange={setVitallyUnstable}
            />
            <CheckboxRow
              label="Patient is requiring oxygen?"
              checked={requiresOxygen}
              onChange={setRequiresOxygen}
            />
          </div>
        </FormSection>

        <FormSection title="Clinical details" tone="pink">
          <TextareaField
            name="diagnosis"
            label="Diagnosis"
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={2}
            placeholder="Provisional or working diagnosis"
          />
          <TextareaField
            name="briefHistory"
            label="Brief history"
            required
            value={briefHistory}
            onChange={(e) => setBriefHistory(e.target.value)}
            rows={4}
            placeholder="Presenting complaint, relevant history, examination findings"
          />
        </FormSection>

        <FormSection title="Referring provider" headerColor={primaryColor}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              name="doctorName"
              label="Doctor name"
              required
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
            <Field
              name="facilityName"
              label="Facility name"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
            />
            <Field
              name="doctorPhone"
              label="Phone number"
              value={doctorPhone}
              onChange={(e) => setDoctorPhone(e.target.value)}
              placeholder="Referring clinic / doctor contact"
            />
          </div>
        </FormSection>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border-2 border-sky-300 bg-sky-50/40 p-4 text-sm text-slate-700">
            <p className="font-bold text-sky-900">For the patient</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
              <li>
                If you are pregnant or suspect you might be pregnant, please inform the radiographer /
                doctor.
              </li>
              <li>Please carry any previous imaging studies along with you.</li>
            </ol>
          </div>
          <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            <p className="font-bold text-slate-700">For the radiographer</p>
            <p className="mt-2 text-xs leading-relaxed">
              Date, time, and signature are captured when the study is performed on the imaging worklist.
            </p>
          </div>
        </div>

        <Button type="submit" loading={createRequest.isPending} className="w-full min-h-12">
          Submit imaging request
        </Button>
      </form>

      <div
        className="px-4 py-3 text-center text-xs text-white md:px-6"
        style={{ backgroundColor: primaryColor }}
      >
        <p className="font-semibold">
          {profile.contactPhone ? `Phone: ${profile.contactPhone}` : 'Phone: 0726100462 — 0726100588'}
        </p>
        <p className="mt-1 opacity-90">
          {profile.contactEmail ?? 'info@jalaram.co.ke'}
          {profile.address || profile.physicalAddress
            ? ` · ${profile.physicalAddress ?? profile.address}`
            : ' · Hyrax, Nakuru–Nairobi Highway, Nakuru'}
        </p>
        {profile.website ? <p className="mt-0.5 opacity-90">{profile.website}</p> : null}
      </div>
    </div>
  )
}
