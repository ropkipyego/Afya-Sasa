import type { Request } from 'express';

export interface TenantContext {
  id: string;
  name: string;
  code: string;
  schemaName: string;
  subdomain: string;
}

export interface AuthenticatedUserContext {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  forcePasswordChange?: boolean;
}

export interface RequestContext extends Request {
  tenant?: TenantContext;
  user?: AuthenticatedUserContext;
}
