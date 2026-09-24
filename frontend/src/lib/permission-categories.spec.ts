import { groupPermissionsByResource } from './permission-categories'

describe('groupPermissionsByResource', () => {
  it('groups a long permission list by department', () => {
    const groups = groupPermissionsByResource([
      { id: '1', permissionKey: 'pharmacy:read', resource: 'pharmacy', description: 'View queue' },
      { id: '2', permissionKey: 'pharmacy:dispense', resource: 'pharmacy', description: 'Dispense' },
      { id: '3', permissionKey: 'payments:initiate', resource: 'payments', description: 'Collect' },
    ])
    expect(groups.map((g) => g.label)).toEqual(['Finance / cashier', 'Pharmacy'])
    expect(groups[1].permissions).toHaveLength(2)
  })
})
