/** Default hospital code sent as X-Tenant on every API call. */
export const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT?.trim() || 'demo'

/**
 * When true, the login screen hides "Hospital code" and always uses DEFAULT_TENANT.
 * Set in frontend/.env or Docker build arg VITE_HIDE_TENANT_SELECTOR=true
 */
export const HIDE_TENANT_SELECTOR =
  import.meta.env.VITE_HIDE_TENANT_SELECTOR === 'true'

/** Single-hospital deployments: hide tenant UI in the shell as well. */
export const SINGLE_TENANT_MODE = HIDE_TENANT_SELECTOR
