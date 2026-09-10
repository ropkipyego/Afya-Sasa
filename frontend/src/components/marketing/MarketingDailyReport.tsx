import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Field, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { useAuthStore } from '../../lib/auth-store'

type MarketingVisit = {
  id: string
  visitDate: string
  officerName: string
  facilityName: string
  contactPerson: string | null
  activity: string
  peopleReached: number
  nextAction: string | null
  createdAt: string
}

type MarketingCatalog = {
  sites: string[]
  activities: string[]
}

export function MarketingDailyReport() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [officerName, setOfficerName] = useState(
    user ? `${user.firstName} ${user.lastName}` : '',
  )
  const [facilityName, setFacilityName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [activity, setActivity] = useState('')
  const [peopleReached, setPeopleReached] = useState('')
  const [nextAction, setNextAction] = useState('')

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['marketing-visits'],
    queryFn: () => apiRequest<MarketingVisit[]>('/marketing/visits'),
    refetchInterval: 30_000,
  })

  const { data: catalog } = useQuery({
    queryKey: ['marketing-catalog'],
    queryFn: () => apiRequest<MarketingCatalog>('/marketing/catalog'),
  })
  const sites = catalog?.sites ?? []
  const activities = catalog?.activities ?? []

  const save = useMutation({
    mutationFn: () => {
      const people = Number(peopleReached)
      if (!facilityName.trim()) throw new Error('Select the facility or site visited.')
      if (!activity.trim()) throw new Error('Select the activity.')
      if (!Number.isFinite(people) || people < 0) throw new Error('Enter how many people were reached.')
      return apiRequest('/marketing/visits', {
        method: 'POST',
        body: JSON.stringify({
          visitDate,
          officerName: officerName.trim(),
          facilityName: facilityName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          activity: activity.trim(),
          peopleReached: people,
          nextAction: nextAction.trim() || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Visit logged', `${facilityName.trim()} is on today’s outreach report.`, 'success')
      setFacilityName('')
      setContactPerson('')
      setActivity('')
      setPeopleReached('')
      setNextAction('')
      await queryClient.invalidateQueries({ queryKey: ['marketing-visits'] })
    },
    onError: (error: Error) => notify('Could not save visit', error.message, 'critical'),
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayVisits = visits.filter((row) => row.visitDate === today)
  const todayPeople = todayVisits.reduce((sum, row) => sum + Number(row.peopleReached ?? 0), 0)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatBlock label="Stops today" value={todayVisits.length} />
        <StatBlock label="People reached today" value={todayPeople} />
        <StatBlock label="All logged visits" value={visits.length} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-bold text-slate-900">Log a facility visit</h2>
        <p className="mt-1 text-base text-slate-600">
          Pick the site and activity from the imported list. One officer, one day, many stops.
        </p>
        {!sites.length || !activities.length ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Import sites and activities first from the Catalogs tab (or Hospital Control Center → Import
            service catalogs). Until then the dropdowns stay empty.
          </p>
        ) : null}
        <form
          className="mt-6 grid gap-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <Field
            name="visitDate"
            label="Date"
            type="date"
            required
            className="text-base"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
          <Field
            name="officerName"
            label="Officer"
            required
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
          />
          <SelectField
            name="facilityName"
            label="Facility / site"
            required
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
          >
            <option value="">Select site…</option>
            {sites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="activity"
            label="Activity"
            required
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          >
            <option value="">Select activity…</option>
            {activities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
          <Field
            name="contactPerson"
            label="Contact person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
          <Field
            name="peopleReached"
            label="People reached"
            type="number"
            min={0}
            required
            value={peopleReached}
            onChange={(e) => setPeopleReached(e.target.value)}
          />
          <div className="md:col-span-2">
            <TextareaField
              name="nextAction"
              label="Next action"
              rows={3}
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={save.isPending} className="min-h-12 px-6 text-base">
              Save visit
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-bold text-slate-900">Daily logs</h2>
        <p className="mt-1 text-base text-slate-600">
          Every saved stop. Newest first.
        </p>
        {isLoading ? (
          <div className="mt-6 h-56 animate-skeleton rounded-2xl" />
        ) : visits.length ? (
          <ul className="mt-6 space-y-4">
            {visits.map((visit) => (
              <li key={visit.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900">{visit.facilityName}</p>
                    <p className="mt-1 text-base text-slate-700">{visit.activity}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {visit.visitDate} · {visit.officerName}
                      {visit.contactPerson ? ` · ${visit.contactPerson}` : ''}
                    </p>
                    {visit.nextAction ? (
                      <p className="mt-3 text-base text-slate-700">
                        <span className="font-semibold">Next: </span>
                        {visit.nextAction}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-bold text-teal-900">
                    {visit.peopleReached} reached
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-16 text-center text-base text-slate-500">No outreach visits logged yet.</p>
        )}
      </section>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white px-6 py-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">{label}</p>
      <p className="mt-2 text-4xl font-bold tabular-nums text-teal-950">{value}</p>
    </div>
  )
}
