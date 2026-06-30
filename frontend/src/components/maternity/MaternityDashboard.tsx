import { useQuery } from '@tanstack/react-query'
import { Baby, Heart, Stethoscope, Users } from 'lucide-react'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type DashboardMetrics = {
  ancPatientsToday: number
  mothersInLabour: number
  deliveriesToday: number
  caesareanDeliveries: number
  highRiskMothers: number
  postnatalMothers: number
  nurseryBabies: number
  nicuBabies: number
  expectedDeliveries: number
}

export function MaternityDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['maternity-dashboard'],
    queryFn: () => apiRequest<DashboardMetrics>('/maternity/dashboard'),
    refetchInterval: 60_000,
  })

  const metricCards = [
    { label: 'ANC patients', value: metrics?.ancPatientsToday ?? 0, icon: Heart },
    { label: 'Mothers in labour', value: metrics?.mothersInLabour ?? 0, icon: Stethoscope },
    { label: 'Deliveries today', value: metrics?.deliveriesToday ?? 0, icon: Baby },
    { label: 'Caesarean today', value: metrics?.caesareanDeliveries ?? 0, icon: Baby },
    { label: 'High-risk mothers', value: metrics?.highRiskMothers ?? 0, icon: Stethoscope },
    { label: 'Postnatal mothers', value: metrics?.postnatalMothers ?? 0, icon: Users },
    { label: 'Nursery babies', value: metrics?.nurseryBabies ?? 0, icon: Baby },
    { label: 'NICU babies', value: metrics?.nicuBabies ?? 0, icon: Baby },
    { label: 'Expected deliveries', value: metrics?.expectedDeliveries ?? 0, icon: Heart },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maternity dashboard"
        description="Service-line overview — use tabs above for ANC, labour, nursery, and registry."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((m) => (
          <div key={m.label} className="card-hover rounded-2xl border border-pink-200 bg-pink-50/50 p-5">
            <m.icon className="mb-2 h-5 w-5 text-pink-600" />
            <p className="text-[10px] font-bold uppercase text-slate-600">{m.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>
      <Card className="p-6">
        <p className="text-sm text-slate-600">
          Maternity wards (ANC, Labour, Postnatal, Nursery, NICU) are separate from general male/female/paediatric IPD.
          Every newborn receives their own MRN via <strong>Deliveries → Register newborn patient</strong>.
        </p>
      </Card>
    </div>
  )
}
