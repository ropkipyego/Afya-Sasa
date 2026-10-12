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
  sid?: string;
  iat?: number;
  /** Trusted tenant code captured at login/refresh. */
  tid?: string;
}

export interface RequestContext extends Request {
  tenant?: TenantContext;
  user?: AuthenticatedUserContext;
}
