import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Printer, Search, Trash2 } from 'lucide-react'
import { Alert, Button, Card, Field, Input, PageHeader, SelectField } from '../ui'
import { apiRequest } from '../../lib/api'
import { downloadClinicalFile, uploadClinicalFile, viewClinicalFile } from '../../lib/clinical-upload'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'

type HospitalDocumentRow = {
  id: string
  title: string
  description?: string | null
  category: string
  filename: string
  mimeType: string
  storagePath: string
  audience: string
  createdAt: string
}

const categories = [
  { value: 'all', label: 'All categories' },
  { value: 'policy', label: 'Policies & SOPs' },
  { value: 'protocol', label: 'Clinical protocols' },
  { value: 'form', label: 'Forms & templates' },
  { value: 'training', label: 'Training materials' },
  { value: 'memo', label: 'Memos & circulars' },
  { value: 'general', label: 'General' },
]

const audiences = [
  { value: 'all', label: 'All staff' },
  { value: 'clinical', label: 'Clinical teams' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'reception', label: 'Reception' },
  { value: 'admin', label: 'Administration' },
]

export function HospitalLibrary({ adminMode = false }: { adminMode?: boolean }) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [publishForm, setPublishForm] = useState({
    title: '',
    description: '',
    category: 'general',
    audience: 'all',
  })

  const canPublish =
    adminMode || user?.permissions.includes('hospital_documents:create') === true
  const canDelete = user?.permissions.includes('hospital_documents:delete') === true

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['hospital-documents', category],
    queryFn: () => {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      const query = params.toString()
      return apiRequest<HospitalDocumentRow[]>(
        `/documents/hospital${query ? `?${query}` : ''}`,
      )
    },
  })

  const deleteDoc = useMutation({
    mutationFn: (id: string) => apiRequest(`/documents/hospital/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notify('Document removed', 'Hospital document unpublished.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['hospital-documents'] })
    },
    onError: (error: Error) => notify('Delete failed', error.message, 'critical'),
  })

  const filtered = documents.filter((doc) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      doc.title.toLowerCase().includes(q) ||
      (doc.description ?? '').toLowerCase().includes(q) ||
      doc.filename.toLowerCase().includes(q)
    )
  })

  const publish = async (file: File) => {
    if (!publishForm.title.trim()) {
      notify('Title required', 'Enter a document title before uploading.', 'critical')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadClinicalFile(file, 'hospital-docs', publishForm.title)
      await apiRequest('/documents/hospital', {
        method: 'POST',
        body: JSON.stringify({
          title: publishForm.title.trim(),
          description: publishForm.description.trim() || undefined,
          category: publishForm.category,
          audience: publishForm.audience,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storagePath: uploaded.storagePath,
          fileSize: uploaded.fileSize,
        }),
      })
      notify('Document published', `${publishForm.title} is now available hospital-wide.`, 'success')
      setPublishForm({ title: '', description: '', category: 'general', audience: 'all' })
      await queryClient.invalidateQueries({ queryKey: ['hospital-documents'] })
    } catch (error) {
      notify('Publish failed', (error as Error).message, 'critical')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="workspace-shell animate-fade-in space-y-6">
      <PageHeader
        title="Hospital document library"
        description="Policies, protocols, forms, and circulars published for all departments."
      />

      {canPublish ? (
        <Card className="p-6">
          <PageHeader
            title="Publish hospital document"
            description="Upload PDF, Word, or image files — visible to staff based on audience."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field
              label="Title"
              name="title"
              value={publishForm.title}
              onChange={(e) => setPublishForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <SelectField
              label="Category"
              name="category"
              value={publishForm.category}
              onChange={(e) => setPublishForm((f) => ({ ...f, category: e.target.value }))}
            >
              {categories.filter((c) => c.value !== 'all').map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectField>
            <Field
              label="Description"
              name="description"
              value={publishForm.description}
              onChange={(e) => setPublishForm((f) => ({ ...f, description: e.target.value }))}
            />
            <SelectField
              label="Audience"
              name="audience"
              value={publishForm.audience}
              onChange={(e) => setPublishForm((f) => ({ ...f, audience: e.target.value }))}
            >
              {audiences.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void publish(file)
              }}
            />
            {uploading ? <p className="mt-2 text-xs text-teal-700">Publishing…</p> : null}
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[220px] flex-1 text-sm font-semibold text-slate-800">
            Search
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, memo, policy…" />
            </div>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Category
            <select
              className="input mt-1.5 min-w-[180px]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="mt-6 h-40 animate-skeleton rounded-2xl" />
        ) : filtered.length ? (
          <div className="mt-6 space-y-3">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">{doc.title}</p>
                  <p className="text-xs text-slate-500">
                    {doc.category} · {doc.audience} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {doc.description ? <p className="mt-1 text-sm text-slate-600">{doc.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busyId === `${doc.id}-view`}
                    onClick={async () => {
                      setBusyId(`${doc.id}-view`)
                      try {
                        await viewClinicalFile(doc.storagePath)
                      } catch (error) {
                        notify('View failed', (error as Error).message, 'critical')
                      } finally {
                        setBusyId(null)
                      }
                    }}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busyId === `${doc.id}-print`}
                    onClick={async () => {
                      setBusyId(`${doc.id}-print`)
                      try {
                        await viewClinicalFile(doc.storagePath)
                      } catch (error) {
                        notify('Print failed', (error as Error).message, 'critical')
                      } finally {
                        setBusyId(null)
                      }
                    }}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busyId === doc.id}
                    onClick={async () => {
                      setBusyId(doc.id)
                      try {
                        await downloadClinicalFile(doc.storagePath, doc.filename)
                      } catch (error) {
                        notify('Download failed', (error as Error).message, 'critical')
                      } finally {
                        setBusyId(null)
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete ? (
                    <Button type="button" variant="ghost" onClick={() => deleteDoc.mutate(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert tone="info" className="mt-6">
            No published hospital documents yet. Administrators can publish from this screen or Hospital Control Center.
          </Alert>
        )}
      </Card>
    </div>
  )
}
