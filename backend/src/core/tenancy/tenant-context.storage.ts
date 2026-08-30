import { AsyncLocalStorage } from 'async_hooks';
import { defaultTenantCode } from '../../common/tenant-defaults';

export type TenantRequestContext = {
  schemaName: string;
  tenantCode: string;
};

export const tenantContextStorage = new AsyncLocalStorage<TenantRequestContext>();

export function getTenantSchema(): string {
  return (
    tenantContextStorage.getStore()?.schemaName ??
    (process.env.DEFAULT_TENANT_SCHEMA?.trim() || 'demo')
  );
}

export function getTenantCode(): string {
  return tenantContextStorage.getStore()?.tenantCode ?? defaultTenantCode();
}

export function runWithTenantContext<T>(
  context: TenantRequestContext,
  fn: () => T,
): T {
  return tenantContextStorage.run(context, fn);
}
