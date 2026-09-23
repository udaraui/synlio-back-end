import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { getOrBuildVisibilityCache } from './visibility-cache.util';

@Injectable()
export class TaskVisibilityGuard implements CanActivate {
  constructor(
    @InjectEntityManager() private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'POST' && request.method !== 'GET' && request.method !== 'PUT') return true;

    const isSearchEndpoint = request.url.includes('/search');
    const taskIdParam = request.params.id;

    const activeCompanyId = request.activeCompany?.companyId || parseInt(request.headers['x-selected-company'] as string, 10) || 0;

    let spaceIdFilter = request.body?.filters?.find(f => f.field === 'taskSpaceId');

    // If it's a specific task query and we don't have spaceId in body, fetch the task's spaceId to verify
    if (taskIdParam && !isNaN(Number(taskIdParam)) && !spaceIdFilter) {
      const task = await this.entityManager.query(`SELECT "taskSpaceId" FROM tm_task WHERE id = $1`, [taskIdParam]);
      if (task.length) spaceIdFilter = { value: task[0].taskSpaceId };
    }

    if (!spaceIdFilter) return true; // Let standard auth handle global searches

    // 1. Get unified visibility dictionary from cache or DB
    const visibilityDict = await getOrBuildVisibilityCache(
      this.entityManager,
      this.redisService,
      request.user.email,
      activeCompanyId,
      'task'
    );

    const spaceId = spaceIdFilter.value;
    const taskIds = visibilityDict[spaceId];

    if (!taskIds) {
      return false; // User has no access to this space
    }

    if (taskIds.length === 0) {
      return true; // Empty array means FULL access (Space Owner or Member)
    }

    // 3A. Single Item Validation
    if (taskIdParam && !isNaN(Number(taskIdParam))) {
      return taskIds.includes(Number(taskIdParam));
    }

    // 3B. Mutate payload for Search endpoint
    if (isSearchEndpoint) {
      if (!request.body.filters) {
        request.body.filters = [];
      }
      request.body.filters.push({
        field: 'id',
        matchMode: 'in',
        value: taskIds,
      });
    }

    return true;
  }
}
