import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLE_KEYS = 'roles';
export const Roles = (
  ...roles: [Role, ...Role[]] //to make sure the list is not empty
) => SetMetadata(ROLE_KEYS, roles);
