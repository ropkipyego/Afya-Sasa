import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'

export function MarketingSmsPanel() {
  const [message, setMessage] = useState('Jalaram Hospital reminder: please confirm your outreach appointment.')
  const preview = useQuery({
    queryKey: ['marketing-sms-preview', message],
    queryFn: () =>
      apiRequest<{
        eligibleRecipients: number
        clinicalContentBlocked: boolean
        characterCount: number
        estimatedSegments: number
        consentStored: boolean
        delivery: string
        sendRequires: string
        note: string
      }>(`/marketing/sms/preview?message=${encodeURIComponent(message)}`),
  })

  return (
    <Card className="p-6">
      <PageHeader
        title="Bulk SMS (preview)"
        description="Draft and count audience. Sending is not enabled here until consent records and marketing:manage approval exist."
      />
      <textarea
        className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      {preview.isError ? (
        <Alert tone="error" className="mt-3">
          {formatApiError(preview.error, 'Could not preview audience.')}
        </Alert>
      ) : null}
      {preview.data ? (
        <div className="mt-4 space-y-1 text-sm text-slate-700">
          <p>Eligible recipients: {preview.data.eligibleRecipients}</p>
          <p>Characters / segments: {preview.data.characterCount} / {preview.data.estimatedSegments}</p>
          <p>Consent stored in EMR: {preview.data.consentStored ? 'yes' : 'no'}</p>
          <p>Delivery evidence: {preview.data.delivery}</p>
          {preview.data.clinicalContentBlocked ? (
            <Alert tone="warning">Clinical terms were detected. Marketing messages must not include diagnoses or results.</Alert>
          ) : null}
          <p className="text-xs text-slate-500">{preview.data.note}</p>
        </div>
      ) : null}
      <Button type="button" className="mt-4" disabled>
        Send is disabled until consent + approval workflow is signed off
      </Button>
    </Card>
  )
}
