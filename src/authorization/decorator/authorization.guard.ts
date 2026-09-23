import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTHORIZATION_PERMISSIONS_KEY } from './authorization-permissions.decorator';
import { AuthorizationService } from '../authorization.service';
import { RedisService } from '../../redis/redis.service';
import { UserCompanyView } from 'src/user-management/user/user-company-view/user-company.entity';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,
    private redisService: RedisService,
  ) { }



  async canActivate(
    context: ExecutionContext,
  ): Promise<any> {
    const requiredPermissions = this.reflector.get<string[]>(
      AUTHORIZATION_PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true; // no permissions required
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const selectedCompanyId = request.headers['x-selected-company'];
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }
    let activeCompanyId: number | null = parseInt(
      selectedCompanyId as string,
      10,
    );
    if (isNaN(activeCompanyId) || selectedCompanyId === 'null') {
      activeCompanyId = null;
    }

    // Normalize: Treat both 0 and null as system scope for consistency
    const isSystemScope = activeCompanyId === 0 || activeCompanyId === null;

    let assignedCompanies: UserCompanyView[] = [];

    if (!isSystemScope) {
      const userId = user.userId || user.id;
      if (!userId) {
        throw new UnauthorizedException('Invalid user context');
      }
      assignedCompanies = await this.redisService.getUserCompanies(userId);

      // if (
      //   !assignedCompanies ||
      //   !assignedCompanies.some((a) => a.companyId === activeCompanyId)
      // ) {
      // Use == instead of === to gracefully handle string/number type mismatches from JSON cache
      let hasCompany = assignedCompanies && assignedCompanies.some((a) => a.companyId == activeCompanyId);

      if (!hasCompany) {
        // Fallback: Cache is either empty, or the specific company is missing (stale cache).
        // Let's fetch the fresh company list directly from the database.
        assignedCompanies = await this.authorizationService.getUserCompanyByUserId(userId);

        hasCompany = assignedCompanies && assignedCompanies.some((a) => a.companyId == activeCompanyId);

        // Re-populate the Redis cache with the fresh database results
        if (assignedCompanies && assignedCompanies.length > 0) {
          await this.redisService.setUserCompanies(userId, assignedCompanies);
        }
      }

      if (!hasCompany) {
        throw new ForbiddenException(
          'User is not assigned to the selected company',
        );
      }
    } else {
      assignedCompanies.push({
        userId: user.userId || user.id,
        companyId: activeCompanyId,
        company_code: '',
        company: '',
        isActive: 'active',
      } as any);
    }

    // Retrieve company-grouped privileges directly from the JWT payload
    const rawPrivileges = user.privileges || [];

    // Find the specific privileges for the requested company
    // Normalize lookup: check for both 0 and null if in system scope
    const companyPrivileges = rawPrivileges.find((p: any) => {
      if (isSystemScope) {
        return p.companyId === 0 || p.companyId === null;
      }
      return p.companyId === activeCompanyId;
    });

    const userPermissionsArray: number[] =
      companyPrivileges?.privilegeIds || [];

    if (!userPermissionsArray || userPermissionsArray.length === 0) {
      throw new ForbiddenException(
        isSystemScope
          ? 'No system-level permissions found for this user'
          : 'No permissions found for the selected company',
      );
    }

    // Convert numeric IDs to strings to match requiredPermissions
    const userPermissions = userPermissionsArray.map(String);

    // Check if user has at least one of the required permissions (OR logic)
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm),
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const activeCompany = assignedCompanies.find(
      (a) => a.companyId === activeCompanyId,
    );

    request.activeCompany = activeCompany;

    return !!activeCompany;
    // return true;
  }
}
