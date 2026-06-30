import { IpdAdminSetup } from '../../ipd/IpdAdminSetup'
import { Card, PageHeader } from '../../ui'

export function WardManagementPanel() {
  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Ward & bed management"
          description="Configure wards, beds, and bed board statuses."
        />
      </Card>
      <IpdAdminSetup />
    </div>
  )
}
