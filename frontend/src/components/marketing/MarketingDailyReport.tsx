import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Field, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'
import {
  MARKETING_ACTIVITY_TYPES,
  MARKETING_OUTCOMES,
  activityTypeLabel,
  marketingError,
  outcomeLabel,
  todayIso,
  totalsOf,
  type MarketingActivity,
  type MarketingActivityList,
  type MarketingCatalog,
} from './marketing-shared'

type FormState = {
  activityDate: string
  location: string
  facilityName: string
  contactPerson: string
  contactPhone: string
  purpose: string
  activityType: string
  servicesPromoted: string
  peopleReached: string
  leadsGenerated: string
  referralsGenerated: string
  followUpRequired: boolean
  followUpDate: string
  followUpCompleted: boolean
  outcome: string
  nextAction: string
  notes: string
}

function emptyForm(date: string): FormState {
  return {
    activityDate: date,
    location: '',
    facilityName: '',
    contactPerson: '',
    contactPhone: '',
    purpose: '',
    activityType: '',
    servicesPromoted: '',
    peopleReached: '',
    leadsGenerated: '',
    referralsGenerated: '',
    followUpRequired: false,
    followUpDate: '',
    followUpCompleted: false,
    outcome: '',
    nextAction: '',
    notes: '',
  }
}

function formFromActivity(row: MarketingActivity): FormState {
  return {
    activityDate: row.activityDate,
    location: row.location ?? '',
    facilityName: row.facilityName,
    contactPerson: row.contactPerson ?? '',
    contactPhone: row.contactPhone ?? '',
    purpose: row.purpose ?? '',
    activityType: row.activityType,
    servicesPromoted: row.servicesPromoted ?? '',
    peopleReached: String(row.peopleReached ?? 0),
    leadsGenerated: String(row.leadsGenerated ?? 0),
    referralsGenerated: String(row.referralsGenerated ?? 0),
    followUpRequired: row.followUpRequired,
    followUpDate: row.followUpDate ?? '',
    followUpCompleted: row.followUpCompleted,
    outcome: row.outcome ?? '',
    nextAction: row.nextAction ?? '',
    notes: row.notes ?? '',
  }
}

function payloadFromForm(form: FormState) {
  const people = form.peopleReached.trim() === '' ? 0 : Number(form.peopleReached)
  const leads = form.leadsGenerated.trim() === '' ? 0 : Number(form.leadsGenerated)
  const referrals = form.referralsGenerated.trim() === '' ? 0 : Number(form.referralsGenerated)
  if (!form.activityDate) throw new Error('Choose the activity date.')
  if (!form.facilityName.trim()) throw new Error('Enter the facility or organization.')
  if (!form.activityType) throw new Error('Select the activity type.')
  if ([people, leads, referrals].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('People, leads, and referrals cannot be negative.')
  }
  return {
    activityDate: form.activityDate,
    location: form.location.trim() || undefined,
    facilityName: form.facilityName.trim(),
    contactPerson: form.contactPerson.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    purpose: form.purpose.trim() || undefined,
    activityType: form.activityType,
    servicesPromoted: form.servicesPromoted.trim() || undefined,
    peopleReached: people,
    leadsGenerated: leads,
    referralsGenerated: referrals,
    followUpRequired: form.followUpRequired,
    followUpDate: form.followUpDate || undefined,
    followUpCompleted: form.followUpCompleted,
    outcome: form.outcome || undefined,
    nextAction: form.nextAction.trim() || undefined,
    notes: form.notes.trim() || undefined,
  }
}

export function MarketingDailyReport() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const canCreate = user?.permissions.includes('marketing:create')
  const canUpdate = Boolean(
    user?.permissions.includes('marketing:update') || user?.permissions.includes('marketing:manage'),
  )
  const canDelete = Boolean(
    user?.permissions.includes('marketing:delete') || user?.permissions.includes('marketing:manage'),
  )
  const canManage = user?.permissions.includes('marketing:manage')
  const [reportDate, setReportDate] = useState(todayIso)
  const [form, setForm] = useState<FormState>(() => emptyForm(todayIso()))
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: catalog } = useQuery({
    queryKey: ['marketing-catalog'],
    queryFn: () => apiRequest<MarketingCatalog>('/marketing/catalog'),
  })
  const {
    data: list,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['marketing-activities', 'daily', reportDate],
    queryFn: () =>
      apiRequest<MarketingActivityList>(
        `/marketing/activities?date=${reportDate}&page=1&pageSize=100`,
      ),
  })

  const activities = list?.items ?? []
  const totals = useMemo(() => totalsOf(activities), [activities])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['marketing-activities'] })
    await queryClient.invalidateQueries({ queryKey: ['marketing-dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['marketing-team-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['marketing-visits'] })
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form)
      if (editingId) {
        return apiRequest(`/marketing/activities/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      }
      return apiRequest('/marketing/activities', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      notify(editingId ? 'Activity updated' : 'Activity saved', 'Daily report refreshed.', 'success')
      const keptDate = form.activityDate
      setEditingId(null)
      setForm(emptyForm(keptDate))
      setReportDate(keptDate)
      await invalidate()
    },
    onError: (err: Error) => {
      notify('Could not save activity', marketingError(err, 'Unable to save the activity.'), 'critical')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/marketing/activities/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notify('Activity removed', 'It is no longer on this daily report.', 'success')
      if (editingId) {
        setEditingId(null)
        setForm(emptyForm(reportDate))
      }
      await invalidate()
    },
    onError: (err: Error) => {
      notify('Could not remove activity', marketingError(err, 'Unable to remove the activity.'), 'critical')
    },
  })

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field
          name="reportDate"
          label="Report date"
          type="date"
          required
          value={reportDate}
          onChange={(event) => {
            const next = event.target.value
            setReportDate(next)
            if (!editingId) setField('activityDate', next)
          }}
        />
        <p className="pb-2 text-sm text-slate-600">
          Record what you actually did. Catalog names are suggestions only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Activities" value={totals.activities} />
        <Stat label="Locations" value={totals.locations} />
        <Stat label="Facilities" value={totals.facilities} />
        <Stat label="People reached" value={totals.people} />
        <Stat label="Leads" value={totals.leads} />
        <Stat label="Referrals" value={totals.referrals} />
      </div>

      {canCreate || (canUpdate && editingId) ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-slate-900">
            {editingId ? 'Edit activity' : 'Add activity'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Logged as {user ? `${user.firstName} ${user.lastName}` : 'the signed-in staff member'}.
            {canManage ? ' Managers can correct another person’s record from the team view.' : ''}
          </p>
          <datalist id="marketing-site-suggestions">
            {(catalog?.sites ?? []).map((site) => (
              <option key={site} value={site} />
            ))}
          </datalist>
          <datalist id="marketing-service-suggestions">
            {(catalog?.activities ?? []).map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <form
            className="mt-5 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (save.isPending) return
              save.mutate()
            }}
          >
            <Field
              name="activityDate"
              label="Activity date"
              type="date"
              required
              value={form.activityDate}
              onChange={(event) => setField('activityDate', event.target.value)}
            />
            <SelectField
              name="activityType"
              label="Activity type"
              required
              value={form.activityType}
              onChange={(event) => setField('activityType', event.target.value)}
            >
              <option value="">Select type…</option>
              {MARKETING_ACTIVITY_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <Field
              name="location"
              label="Location / area"
              list="marketing-site-suggestions"
              value={form.location}
              onChange={(event) => setField('location', event.target.value)}
            />
            <Field
              name="facilityName"
              label="Facility / organization"
              required
              list="marketing-site-suggestions"
              hint="Type a new name if it is not in the catalog."
              value={form.facilityName}
              onChange={(event) => setField('facilityName', event.target.value)}
            />
            <Field
              name="contactPerson"
              label="Contact person"
              value={form.contactPerson}
              onChange={(event) => setField('contactPerson', event.target.value)}
            />
            <Field
              name="contactPhone"
              label="Phone / contact"
              value={form.contactPhone}
              onChange={(event) => setField('contactPhone', event.target.value)}
            />
            <Field
              name="purpose"
              label="Purpose"
              value={form.purpose}
              onChange={(event) => setField('purpose', event.target.value)}
            />
            <Field
              name="servicesPromoted"
              label="Services promoted"
              list="marketing-service-suggestions"
              hint="Free text. Catalog services appear as suggestions."
              value={form.servicesPromoted}
              onChange={(event) => setField('servicesPromoted', event.target.value)}
            />
            <Field
              name="peopleReached"
              label="People reached"
              type="number"
              min={0}
              value={form.peopleReached}
              onChange={(event) => setField('peopleReached', event.target.value)}
            />
            <Field
              name="leadsGenerated"
              label="Leads generated"
              type="number"
              min={0}
              value={form.leadsGenerated}
              onChange={(event) => setField('leadsGenerated', event.target.value)}
            />
            <Field
              name="referralsGenerated"
              label="Referrals generated"
              type="number"
              min={0}
              value={form.referralsGenerated}
              onChange={(event) => setField('referralsGenerated', event.target.value)}
            />
            <SelectField
              name="outcome"
              label="Outcome"
              value={form.outcome}
              onChange={(event) => setField('outcome', event.target.value)}
            >
              <option value="">Not set</option>
              {MARKETING_OUTCOMES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.followUpRequired}
                onChange={(event) => setField('followUpRequired', event.target.checked)}
              />
              Follow-up required
            </label>
            <Field
              name="followUpDate"
              label="Follow-up date"
              type="date"
              value={form.followUpDate}
              onChange={(event) => setField('followUpDate', event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.followUpCompleted}
                onChange={(event) => setField('followUpCompleted', event.target.checked)}
              />
              Follow-up completed
            </label>
            <div className="md:col-span-2">
              <TextareaField
                name="nextAction"
                label="Next action"
                rows={2}
                value={form.nextAction}
                onChange={(event) => setField('nextAction', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <TextareaField
                name="notes"
                label="Notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" loading={save.isPending} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Save activity'}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={save.isPending}
                  onClick={() => {
                    setEditingId(null)
                    setForm(emptyForm(reportDate))
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
            {save.error ? (
              <div className="md:col-span-2">
                <Alert tone="error">{marketingError(save.error, 'Unable to save the activity.')}</Alert>
              </div>
            ) : null}
          </form>
        </section>
      ) : (
        <Alert tone="warning">You can view this report but cannot add activities.</Alert>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-slate-900">Activities on {reportDate}</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading today’s activities…</p>
        ) : isError ? (
          <div className="mt-4 space-y-3">
            <Alert tone="error">{marketingError(error, 'Unable to load activities.')}</Alert>
            <Button type="button" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : activities.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Facility</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Contact</th>
                  <th className="px-2 py-2">Reached</th>
                  <th className="px-2 py-2">Leads</th>
                  <th className="px-2 py-2">Referrals</th>
                  <th className="px-2 py-2">Follow-up</th>
                  <th className="px-2 py-2">Outcome</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-3">
                      <p className="font-semibold text-slate-900">{row.facilityName}</p>
                      <p className="text-xs text-slate-500">{row.location || 'No area'} · {row.ownerName}</p>
                    </td>
                    <td className="px-2 py-3">{activityTypeLabel(row.activityType)}</td>
                    <td className="px-2 py-3">
                      {row.contactPerson || '—'}
                      {row.contactPhone ? <p className="text-xs text-slate-500">{row.contactPhone}</p> : null}
                    </td>
                    <td className="px-2 py-3">{row.peopleReached}</td>
                    <td className="px-2 py-3">{row.leadsGenerated}</td>
                    <td className="px-2 py-3">{row.referralsGenerated}</td>
                    <td className="px-2 py-3">
                      {row.followUpRequired ? row.followUpDate || 'Due' : '—'}
                      {row.followUpCompleted ? ' · done' : ''}
                    </td>
                    <td className="px-2 py-3">{outcomeLabel(row.outcome)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canUpdate ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs"
                            disabled={save.isPending || remove.isPending}
                            onClick={() => {
                              setEditingId(row.id)
                              setForm(formFromActivity(row))
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs"
                            disabled={remove.isPending}
                            onClick={() => {
                              const ok = window.confirm(
                                `Remove ${row.facilityName} from this daily report?`,
                              )
                              if (!ok) return
                              remove.mutate(row.id)
                            }}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 py-8 text-center text-sm text-slate-500">
            No activities on this date yet. Save the first one above.
          </p>
        )}
        {remove.error ? (
          <Alert tone="error" className="mt-3">
            {marketingError(remove.error, 'Unable to remove the activity.')}
          </Alert>
        ) : null}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}
