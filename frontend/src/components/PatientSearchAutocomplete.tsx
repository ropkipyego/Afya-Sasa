import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { QrCode, Search, User } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { Input, Button } from './ui'
import { useClinicalCatalog } from '../hooks/useClinicalCatalog'
import { isFeatureEnabled } from '../lib/hospital-configuration'

export type PatientSearchItem = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender?: string
  primaryPhone: string
  identifiers?: { type: string; value: string }[]
}

type PatientSearchResponse = {
  items: PatientSearchItem[]
  meta: { page: number; pageSize: number; total: number }
}

export function PatientSearchAutocomplete({
  selected,
  onSelect,
  placeholder = 'Start typing name, patient no, phone, or ID…',
  className,
}: {
  selected: PatientSearchItem | null
  onSelect: (patient: PatientSearchItem | null) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['patient-autocomplete', query],
    queryFn: () =>
      apiRequest<PatientSearchResponse>(
        `/patients?q=${encodeURIComponent(query)}&pageSize=8`,
      ),
    enabled: query.trim().length >= 2,
  })

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const suggestions = data?.items ?? []
  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {selected ? (
        <div className="animate-fade-in flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {selected.firstName} {selected.lastName}
              </p>
              <p className="text-sm text-slate-600">
                {selected.patientNo} · {selected.primaryPhone}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-red-600 hover:text-red-700"
            onClick={() => {
              onSelect(null)
              setQuery('')
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              autoComplete="off"
            />
            {isFetching ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                Searching…
              </span>
            ) : null}
          </div>

          {showDropdown ? (
            <ul className="animate-fade-in absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {suggestions.length ? (
                suggestions.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left transition hover:bg-teal-50"
                      onClick={() => {
                        onSelect(patient)
                        setQuery('')
                        setOpen(false)
                      }}
                    >
                      <p className="font-semibold text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {patient.patientNo} · DOB {patient.dateOfBirth} · {patient.primaryPhone}
                      </p>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-sm text-slate-500">
                  No patients match &ldquo;{query}&rdquo;
                </li>
              )}
            </ul>
          ) : null}

          {query.trim().length === 1 ? (
            <p className="mt-2 text-xs text-slate-500">Type one more character for suggestions</p>
          ) : null}
        </>
      )}
    </div>
  )
}

export function PatientQrLookup({
  onSelect,
}: {
  onSelect: (patient: PatientSearchItem) => void
}) {
  const [code, setCode] = useState('')
  const lookup = useMutation({
    mutationFn: (qrCode: string) =>
      apiRequest<PatientSearchItem>(`/patients/qr/${encodeURIComponent(qrCode)}`),
    onSuccess: (patient) => {
      onSelect(patient)
      setCode('')
    },
  })

  return (
    <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-800">
        <QrCode className="h-4 w-4" />
        Scan patient QR code
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) lookup.mutate(code.trim())
        }}
      >
        <Input
          className="min-w-[200px] flex-1 font-mono text-sm"
          value={code}
          placeholder="afyasasa:patient:MRN or scan result"
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" loading={lookup.isPending} disabled={!code.trim()}>
          Look up
        </Button>
      </form>
      {lookup.isError ? (
        <p className="mt-2 text-xs text-red-600">{(lookup.error as Error).message}</p>
      ) : null}
    </div>
  )
}

export function PatientSearchBrowse({
  onSelect,
  placeholder = 'Search by name, patient number, phone, or ID…',
}: {
  onSelect: (patient: PatientSearchItem) => void
  placeholder?: string
}) {
  const { data: catalog } = useClinicalCatalog()
  const qrEnabled = isFeatureEnabled(catalog, 'qrPatientScan')
  const [query, setQuery] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['patient-browse', query],
    queryFn: () =>
      apiRequest<PatientSearchResponse>(
        `/patients?q=${encodeURIComponent(query)}&pageSize=12`,
      ),
    enabled: query.trim().length >= 2,
  })

  const patients = data?.items ?? []

  return (
    <div className="space-y-4">
      {qrEnabled ? <PatientQrLookup onSelect={onSelect} /> : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        {isFetching ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Searching…
          </span>
        ) : null}
      </div>

      {query.trim().length === 1 ? (
        <p className="text-xs text-slate-500">Type one more character to see matches</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {patients.length ? (
          <ul className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-teal-50/60"
                  onClick={() => onSelect(patient)}
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {patient.patientNo} · DOB {patient.dateOfBirth}
                      {patient.gender ? ` · ${patient.gender}` : ''} · {patient.primaryPhone}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {patient.identifiers?.map((item) => `${item.type}: ${item.value}`).join(' · ') ||
                        'No ID on file'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                    Open
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim().length >= 2 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No patients found. Register only after confirming no duplicate exists.
          </p>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">
            Start typing to search the registry before registering someone new.
          </p>
        )}
      </div>
    </div>
  )
}
