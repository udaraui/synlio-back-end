import { SetMetadata } from '@nestjs/common';

export const AUTHORIZATION_PERMISSIONS_KEY = 'authorization_permissions';

export const AuthorizationPermissions = (...permissions: string[]) =>
  SetMetadata(AUTHORIZATION_PERMISSIONS_KEY, permissions);
