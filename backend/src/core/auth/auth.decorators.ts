import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
