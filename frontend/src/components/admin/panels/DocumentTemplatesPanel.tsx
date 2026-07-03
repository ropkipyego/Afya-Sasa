import { useEffect, useRef, useState } from 'react'
import { FileUp, Save, Trash2 } from 'lucide-react'
import { Alert, Button, Card, PageHeader } from '../../ui'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
import { CONFIG_DEPENDENCY_HINTS } from '../../../lib/hospital-configuration'
import { defaultPrintTemplates } from '../../../lib/template-engine'
import { uploadClinicalFile } from '../../../lib/clinical-upload'
import { notify } from '../../../lib/notify'

const TEMPLATE_CATALOG = [
  { key: 'sick_sheet', label: 'Sick sheet / medical certificate' },
  { key: 'referral_letter', label: 'Referral letter' },
  { key: 'patient_card', label: 'Patient card' },
  { key: 'discharge_summary', label: 'Discharge summary (starter)' },
  { key: 'lab_report', label: 'Laboratory report (starter)' },
  { key: 'radiology_report', label: 'Radiology report (starter)' },
  { key: 'moh_705a', label: 'MOH 705A — under 5 morbidity' },
  { key: 'moh_705b', label: 'MOH 705B — 5+ morbidity' },
  { key: 'moh_706', label: 'MOH 706 — laboratory summary' },
  { key: 'moh_717', label: 'MOH 717 — monthly workload' },
]

const MOH_TAG_HINTS: Record<string, string> = {
  moh_705a:
    '{facilityName}, {mohFacilityCode}, {reportMonth}, {reportYear}, {#lines}{condition}{newCases}{/lines}',
  moh_705b:
    '{facilityName}, {mohFacilityCode}, {reportMonth}, {reportYear}, {#lines}{condition}{newCases}{/lines}',
  moh_706:
    '{facilityName}, {totalLabRequests}, {#groups}{section}{testsDone}{positiveResults}{/groups}',
  moh_717:
    '{facilityName}, {outpatientVisits}, {admissions}, {discharges}, {deliveries}',
}

const starterTemplates: Record<string, string> = {
  discharge_summary: `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px">
<h1>{{facilityName}}</h1><h2>Discharge Summary</h2>
<p><strong>Patient:</strong> {{patientName}} ({{patientNo}})</p>
<div>{{summaryBody}}</div>
<p class="footer">{{footerText}}</p></body></html>`,
  lab_report: `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px">
<h1>{{facilityName}}</h1><h2>Laboratory Report</h2>
<p>{{patientName}} · {{testName}}</p><div>{{resultsBody}}</div></body></html>`,
  radiology_report: `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px">
<h1>{{facilityName}}</h1><h2>Radiology Report</h2>
<p>{{patientName}} · {{modality}}</p><div>{{reportBody}}</div></body></html>`,
}

export function DocumentTemplatesPanel() {
  const { catalog, saveCatalog } = useHospitalConfiguration()
  const [templateKey, setTemplateKey] = useState('sick_sheet')
  const [templateHtml, setTemplateHtml] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentTemplate = catalog.printTemplates?.[templateKey]
  const docxUploaded = Boolean(currentTemplate?.docxStoragePath)

  useEffect(() => {
    const fromCatalog = catalog.printTemplates?.[templateKey]?.html
    const fromDefault = defaultPrintTemplates[templateKey]?.html
    const fromStarter = starterTemplates[templateKey]
    setTemplateHtml(fromCatalog ?? fromDefault ?? fromStarter ?? '')
  }, [catalog.printTemplates, templateKey])

  const save = async () => {
    const name =
      TEMPLATE_CATALOG.find((t) => t.key === templateKey)?.label ??
      defaultPrintTemplates[templateKey]?.name ??
      templateKey
    try {
      await saveCatalog.mutateAsync({
        printTemplates: {
          ...(catalog.printTemplates ?? {}),
          [templateKey]: {
            ...(catalog.printTemplates?.[templateKey] ?? {}),
            name,
            html: templateHtml || undefined,
          },
        },
      })
      notify('Template saved', `${name} will be used for printing.`, 'success')
    } catch (error) {
      notify('Save failed', (error as Error).message, 'critical')
    }
  }

  const handleDocxUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      notify('Invalid file', 'Please upload a .docx Word document.', 'critical')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadClinicalFile(file, 'templates', templateKey)
      const name =
        TEMPLATE_CATALOG.find((t) => t.key === templateKey)?.label ??
        defaultPrintTemplates[templateKey]?.name ??
        templateKey
      await saveCatalog.mutateAsync({
        printTemplates: {
          ...(catalog.printTemplates ?? {}),
          [templateKey]: {
            ...(catalog.printTemplates?.[templateKey] ?? {}),
            name,
            html: templateHtml || catalog.printTemplates?.[templateKey]?.html,
            docxStoragePath: uploaded.storagePath,
            docxFilename: uploaded.filename,
          },
        },
      })
      notify('DOCX uploaded', `${uploaded.filename} is ready for merge printing.`, 'success')
    } catch (error) {
      notify('Upload failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeDocx = async () => {
    const name =
      TEMPLATE_CATALOG.find((t) => t.key === templateKey)?.label ?? templateKey
    const existing = catalog.printTemplates?.[templateKey]
    const rest = existing
      ? (({ docxStoragePath: _a, docxFilename: _b, ...keep }) => keep)(existing)
      : { name }
    try {
      await saveCatalog.mutateAsync({
        printTemplates: {
          ...(catalog.printTemplates ?? {}),
          [templateKey]: { ...rest, name, html: templateHtml || existing?.html },
        },
      })
      notify('DOCX removed', `${name} will use HTML fallback if available.`, 'success')
    } catch (error) {
      notify('Remove failed', (error as Error).message, 'critical')
    }
  }

  return (
    <Card className="p-8">
      <PageHeader
        title="Document template center"
        description="Upload official Word (.docx) templates with merge tags, or edit HTML fallbacks for browser printing."
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">Configuration dependency</p>
        <p className="mt-1">{CONFIG_DEPENDENCY_HINTS.printTemplates.join(' · ')}.</p>
        <p className="mt-2 text-xs text-slate-500">
          DOCX tags use single braces: {'{facilityName}'}, {'{patientName}'}, {'{doctorName}'}.
          Lists: {'{#lines}{condition}{newCases}{/lines}'}.
          HTML fallback uses double braces: {'{{facilityName}}'}.
        </p>
        {MOH_TAG_HINTS[templateKey] ? (
          <p className="mt-2 text-xs text-teal-800">
            MOH tags for this form: {MOH_TAG_HINTS[templateKey]}
          </p>
        ) : null}
      </div>

      <div className="mt-8 space-y-4">
        <label className="block text-sm font-semibold text-slate-800">
          Template
          <select
            className="input mt-1.5 w-full max-w-md"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
          >
            {TEMPLATE_CATALOG.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">Word template (.docx)</p>
          <p className="mt-1 text-xs text-slate-500">
            {docxUploaded
              ? `Uploaded: ${currentTemplate?.docxFilename ?? 'template.docx'}`
              : 'No DOCX uploaded — browser will use HTML fallback below.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleDocxUpload(file)
              }}
            />
            <Button
              type="button"
              variant="secondary"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              {docxUploaded ? 'Replace DOCX' : 'Upload DOCX'}
            </Button>
            {docxUploaded ? (
              <Button type="button" variant="ghost" onClick={() => void removeDocx()}>
                <Trash2 className="h-4 w-4" />
                Remove DOCX
              </Button>
            ) : null}
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-800">
          HTML fallback (optional)
          <textarea
            className="input mt-1.5 min-h-[280px] w-full font-mono text-xs"
            value={templateHtml}
            onChange={(e) => setTemplateHtml(e.target.value)}
            placeholder="Leave empty if you only use DOCX templates."
          />
        </label>
        <Button type="button" loading={saveCatalog.isPending} onClick={() => void save()}>
          <Save className="h-4 w-4" />
          Save template
        </Button>
      </div>
      {saveCatalog.error ? <Alert tone="error">{saveCatalog.error.message}</Alert> : null}
    </Card>
  )
}
