import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type RegistryRow = {
  id: string
  birthDate: string
  deliveryType: string
  birthOrder: number
  multipleBirth: string
  motherPatient: { patientNo: string; firstName: string; lastName: string }
  babyPatient: { patientNo: string; firstName: string; lastName: string }
  newborn: { tempName: string | null; babyName: string | null; sex?: string; birthWeightGrams?: number } | null
}

function exportBirthRegister(rows: RegistryRow[]) {
  const html = `<!DOCTYPE html><html><head><title>Birth Register</title>
<style>body{font-family:Inter,sans-serif;padding:32px} table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #cbd5e1;padding:8px;text-align:left} th{background:#f1f5f9}</style></head><body>
<h1>AfyaSasa Birth Register</h1>
<p>Generated ${new Date().toLocaleString()}</p>
<table><thead><tr><th>Date</th><th>Mother</th><th>Baby</th><th>MRN</th><th>Delivery</th><th>Multiple</th></tr></thead><tbody>
${rows.map((r) => `<tr>
<td>${r.birthDate}</td>
<td>${r.motherPatient.firstName} ${r.motherPatient.lastName} (${r.motherPatient.patientNo})</td>
<td>${r.newborn?.babyName ?? r.newborn?.tempName ?? r.babyPatient.firstName}</td>
<td>${r.babyPatient.patientNo}</td>
<td>${r.deliveryType}</td>
<td>${r.multipleBirth}${r.birthOrder > 1 ? ` #${r.birthOrder}` : ''}</td>
</tr>`).join('')}
</tbody></table></body></html>`
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.print()
  }
}

export function BirthRegister() {
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['mother-baby-registry'],
    queryFn: () => apiRequest<RegistryRow[]>('/maternity/mother-baby-registry'),
  })

  return (
    <Card className="p-5 md:p-8">
      <PageHeader
        title="Birth register"
        description="Official register of deliveries — export for records office."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!links.length} onClick={() => exportBirthRegister(links)}>
              <Printer className="h-4 w-4" />
              Print register
            </Button>
            <Button type="button" variant="ghost" disabled={!links.length} onClick={() => exportBirthRegister(links)}>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        }
      />
      {isLoading ? (
        <div className="mt-6 h-40 animate-skeleton rounded-2xl" />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-3 pr-4">Birth date</th>
                <th className="py-3 pr-4">Mother</th>
                <th className="py-3 pr-4">Baby</th>
                <th className="py-3 pr-4">Baby MRN</th>
                <th className="py-3">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {links.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-4 pr-4">{row.birthDate}</td>
                  <td className="py-4 pr-4">{row.motherPatient.firstName} {row.motherPatient.lastName}</td>
                  <td className="py-4 pr-4">{row.newborn?.babyName ?? row.newborn?.tempName ?? 'Unnamed'}</td>
                  <td className="py-4 pr-4 font-mono text-xs">{row.babyPatient.patientNo}</td>
                  <td className="py-4 capitalize">{row.deliveryType.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!links.length ? <p className="py-12 text-center text-slate-500">No births registered yet.</p> : null}
        </div>
      )}
    </Card>
  )
}
