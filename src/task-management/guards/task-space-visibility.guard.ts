import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { getOrBuildVisibilityCache } from './visibility-cache.util';

@Injectable()
export class TaskSpaceVisibilityGuard implements CanActivate {
  constructor(
    @InjectEntityManager() private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Apply this guard to /search and any single-item /:id GET/PUT endpoints
    if (request.method !== 'POST' && request.method !== 'GET' && request.method !== 'PUT') {
      return true;
    }

    const isSearchEndpoint = request.url.includes('/search');
    const spaceIdParam = request.params.id;

    const activeCompanyId = request.activeCompany?.companyId || 0;

    // 1. Get unified visibility dictionary from cache or DB
    const visibilityDict = await getOrBuildVisibilityCache(
      this.entityManager,
      this.redisService,
      user.email,
      activeCompanyId,
      'task space'
    );

    const spaceIds = Object.keys(visibilityDict).map(Number);

    if (spaceIds.length === 0) {
      // console.log(`[TaskSpaceVisibilityGuard] 403 - spaceIds is empty for user ${user.email} and company ${activeCompanyId}`);
      return false; // Block request, no access to any space
    }

    // Store the accessible IDs in the request object for endpoints that want to filter lists (like GET /task-space)
    request.accessibleSpaceIds = spaceIds;

    // 3A. If it's a specific item endpoint (/:id), validate the ID against the accessible list
    if (spaceIdParam && !isNaN(Number(spaceIdParam))) {
      const hasAccess = spaceIds.includes(Number(spaceIdParam));
      if (!hasAccess) {
        // console.log(`[TaskSpaceVisibilityGuard] 403 - User ${user.email} does not have access to space ${spaceIdParam}. Accessible: ${spaceIds}`);
      }
      return hasAccess;
    }

    // 3B. If it's the /search endpoint, inject filters into request body to keep the controller clean
    if (isSearchEndpoint) {
      if (!request.body.filters) request.body.filters = [];

      // Remove any user-provided userId filters to prevent bypassing
      request.body.filters = request.body.filters.filter(f => f.field !== 'userId');

      request.body.filters.push({
        field: 'id',
        matchMode: 'in',
        value: spaceIds,
      });
    }

    return true;
  }
}
