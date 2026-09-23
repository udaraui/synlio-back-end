import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TicketSpaceVisibilityGuard implements CanActivate {
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

    const userId = user.userId;
    const activeCompanyId = request.activeCompany?.companyId || 0;

    // 1. Try Redis Cache first
    const cacheKey = `user_accessible_ticket_spaces:${userId}`;
    const cachedIds = await this.redisService.get(cacheKey);

    let spaceIds: number[] = [];

    if (cachedIds) {
      spaceIds = JSON.parse(cachedIds);
      console.log(`getting ticket space data from cache for user: ${user.email}, company :${activeCompanyId}`);
    } else {
      console.log(`getting ticket space data from db for user: ${user.email}, company :${activeCompanyId}`);
      // 2. Fallback to SQL
      const accessibleTicketSpaces = await this.entityManager.query(`
        SELECT "ticketSpaceId" FROM ticket_space_member WHERE "userId" = $1
      `, [userId]);

      spaceIds = accessibleTicketSpaces.map((row: any) => row.ticketSpaceId);

      // Save to cache indefinitely
      await this.redisService.set(cacheKey, JSON.stringify(spaceIds)); 
    }

    if (spaceIds.length === 0) return false; // Block request, no access to any space

    // Store the accessible IDs in the request object for endpoints that want to filter lists (like GET /ticket-space)
    request.accessibleSpaceIds = spaceIds;

    // 3A. If it's a specific item endpoint (/:id), validate the ID against the accessible list
    if (spaceIdParam && !isNaN(Number(spaceIdParam))) {
      return spaceIds.includes(Number(spaceIdParam));
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
