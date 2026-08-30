import { ClinicalOrdersDashboard } from './ClinicalOrdersDashboard'

/** Cross-department clinical orders (lab, imaging, procedures) — pharmacy has its own module. */
export function OrdersHub() {
  return (
    <div className="workspace-shell animate-fade-in">
      <ClinicalOrdersDashboard embedded />
    </div>
  )
}
