import type { ExtendedClinicalCatalog } from './hospital-configuration'
import { isModuleEnabled } from './hospital-configuration'
import { navModuleMap } from './nav-module-filter'
import { navigation } from './navigation'
import { resolveScreen } from './screen-aliases'

export type LabWorkspaceTab = 'overview' | 'worklist' | 'bloodbank'
export type ImagingWorkspaceTab = 'overview' | 'worklist'

/** Laboratory menu → LabModule tab. Mirrors App.tsx destinations. */
export function labInitialTab(screen: string): LabWorkspaceTab {
  const canonical = resolveScreen(screen)
  if (canonical === 'Lab Queue') return 'worklist'
  if (canonical === 'Blood Bank') return 'bloodbank'
  return 'overview'
}

/** Radiology menu → ImagingModule tab. Overview and worklist must not collapse. */
export function imagingInitialTab(screen: string): ImagingWorkspaceTab {
  return resolveScreen(screen) === 'Imaging Queue' ? 'worklist' : 'overview'
}

export function requiredPermissionForScreen(screen: string): string | undefined {
  const canonical = resolveScreen(screen)
  return navigation.find((item) => item.label === canonical)?.permission
}

/**
 * Screen entry uses the same permission key as the sidebar item.
 * Unknown labels are denied (they are not a way around RBAC).
 */
export function canAccessScreen(
  screen: string,
  permissions: readonly string[],
  catalog?: ExtendedClinicalCatalog | null,
): boolean {
  const canonical = resolveScreen(screen)
  const item = navigation.find((entry) => entry.label === canonical)
  if (!item) return false
  if (!permissions.includes(item.permission)) return false
  const module = navModuleMap[canonical]
  if (module && catalog && !isModuleEnabled(catalog, module)) return false
  return true
}

export function firstAccessibleScreen(
  permissions: readonly string[],
  catalog?: ExtendedClinicalCatalog | null,
): string {
  const match = navigation.find((item) => canAccessScreen(item.label, permissions, catalog))
  return match?.label ?? 'All Queues'
}
