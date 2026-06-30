import { apiRequest } from './api'
import { uploadClinicalFile } from './clinical-upload'

export type ClinicalDocumentType =
  | 'consent'
  | 'referral_letter'
  | 'insurance'
  | 'lab_attachment'
  | 'radiology_pdf'
  | 'sick_sheet'
  | 'medical_certificate'
  | 'scanned_record'
  | 'discharge_summary'
  | 'operation_note'
  | 'other'

export type ClinicalDocumentRow = {
  id: string
  documentType: ClinicalDocumentType
  title: string
  description?: string | null
  filename: string
  mimeType: string
  storagePath: string
  fileSize: number
  createdAt: string
}

export async function registerClinicalDocument(input: {
  patientId: string
  documentType: ClinicalDocumentType
  title: string
  description?: string
  filename: string
  mimeType: string
  storagePath: string
  fileSize: number
}) {
  return apiRequest<ClinicalDocumentRow>('/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function uploadPatientDocument(
  patientId: string,
  file: File,
  documentType: ClinicalDocumentType,
  title?: string,
) {
  const uploaded = await uploadClinicalFile(file, 'documents', patientId)
  return registerClinicalDocument({
    patientId,
    documentType,
    title: title ?? file.name,
    filename: uploaded.filename,
    mimeType: uploaded.mimeType,
    storagePath: uploaded.storagePath,
    fileSize: uploaded.fileSize,
  })
}

export async function listPatientDocuments(patientId: string, type?: string) {
  const query = new URLSearchParams({ patientId })
  if (type) query.set('type', type)
  return apiRequest<ClinicalDocumentRow[]>(`/documents?${query.toString()}`)
}
