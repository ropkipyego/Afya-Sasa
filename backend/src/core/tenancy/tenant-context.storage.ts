import { AsyncLocalStorage } from 'async_hooks';

export type TenantRequestContext = {
  schemaName: string;
  tenantCode: string;
};

export const tenantContextStorage = new AsyncLocalStorage<TenantRequestContext>();

export function getTenantSchema(): string {
  return tenantContextStorage.getStore()?.schemaName ?? 'demo';
}

export function getTenantCode(): string {
  return tenantContextStorage.getStore()?.tenantCode ?? 'demo';
}

export function runWithTenantContext<T>(
  context: TenantRequestContext,
  fn: () => T,
): T {
  return tenantContextStorage.run(context, fn);
}
