import { ROLE_TEMPLATES, filterTemplateKeys } from './role-templates';

describe('role templates', () => {
  it('does not include platform superadmin in ordinary templates', () => {
    for (const template of ROLE_TEMPLATES) {
      expect(template.permissionKeys).not.toContain('platform:superadmin');
      expect(template.name).not.toBe('superadmin');
    }
  })

  it('does not grant laboratory amendment or cancellation to any template', () => {
    for (const template of ROLE_TEMPLATES) {
      expect(template.permissionKeys).not.toContain('lab_results:amend');
      expect(template.permissionKeys).not.toContain('lab_requests:cancel');
    }
  });

  it('drops keys that are not in the live permission catalogue', () => {
    expect(filterTemplateKeys(new Set(['patients:read']), ['patients:read', 'made_up:key'])).toEqual([
      'patients:read',
    ])
  })
})
