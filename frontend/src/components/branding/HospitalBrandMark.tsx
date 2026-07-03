import { Building2, Hospital } from 'lucide-react'
import { resolveHospitalBranding } from '../../lib/hospital-configuration'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'

export function HospitalBrandMark({
  compact = false,
  showFacility = true,
}: {
  compact?: boolean
  showFacility?: boolean
}) {
  const { data: catalog } = useClinicalCatalog()
  const brand = resolveHospitalBranding(catalog)
  const color = brand.primaryColor ?? '#0d9488'

  return (
    <div className="flex items-center gap-3">
      {brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt=""
          className={compact ? 'h-9 w-9 rounded-lg object-contain' : 'h-11 w-11 rounded-xl object-contain'}
        />
      ) : (
        <div
          className={compact ? 'rounded-xl p-2 text-white shadow-md' : 'rounded-xl p-2.5 text-white shadow-md'}
          style={{ background: `linear-gradient(135deg, ${color}, ${brand.accentColor ?? color})` }}
        >
          {compact ? <Hospital size={18} /> : <Hospital size={22} />}
        </div>
      )}
      {showFacility ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
            {brand.shortName ?? 'Hospital'}
          </p>
          <h1 className={compact ? 'text-sm font-bold tracking-tight' : 'text-base font-bold tracking-tight'}>
            {brand.facilityName ?? 'Clinical EMR'}
          </h1>
          {brand.tagline && !compact ? (
            <p className="text-[11px] text-slate-500">{brand.tagline}</p>
          ) : null}
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold uppercase" style={{ color }}>
            {brand.facilityName ?? 'Hospital'}
          </p>
          <h1 className="text-2xl font-bold">Clinical Management</h1>
        </div>
      )}
    </div>
  )
}

export function HospitalFacilityBadge({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <Building2 className="h-3.5 w-3.5 text-slate-400" />
      <span>
        <span className="font-semibold text-slate-800">Facility</span> · {label}
      </span>
    </div>
  )
}
