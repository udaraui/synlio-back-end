import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';
import { getOrBuildVisibilityCache } from '../task-management/guards/visibility-cache.util';

@Injectable()
export class ChatService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
  ) {}

  async processChat(
    message: string,
    conversationId?: string,
    user?: { userId?: number; email?: string; [key: string]: any },
    companyId: number = 0,
    agent?: string,
    context?: any,
  ): Promise<any> {
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL;

      // 1. Resolve accessible ticket spaces (from Redis cache or SQL fallback)
      let allowedTicketSpaceIds: number[] = [];
      if (user?.userId) {
        const ticketCacheKey = `user_accessible_ticket_spaces:${user.userId}`;
        const cachedTicketSpaces = await this.redisService.get(ticketCacheKey);
        if (cachedTicketSpaces) {
          try {
            allowedTicketSpaceIds = JSON.parse(cachedTicketSpaces);
          } catch {
            allowedTicketSpaceIds = [];
          }
        } else {
          const ticketSpaceRows = await this.entityManager.query(
            `SELECT "ticketSpaceId" FROM ticket_space_member WHERE "userId" = $1`,
            [user.userId]
          );
          allowedTicketSpaceIds = ticketSpaceRows.map((r: any) => Number(r.ticketSpaceId));
          await this.redisService.set(ticketCacheKey, JSON.stringify(allowedTicketSpaceIds));
        }
      }

      // 2. Resolve accessible task spaces and guest root task restrictions
      const allowedTaskSpaceIds: number[] = [];
      const rootTaskRestrictions: Record<string, number[]> = {};

      if (user?.email) {
        try {
          const visibilityDict = await getOrBuildVisibilityCache(
            this.entityManager,
            this.redisService,
            user.email,
            companyId,
            'task'
          );
          if (visibilityDict && typeof visibilityDict === 'object') {
            for (const [spaceIdStr, rootTaskIds] of Object.entries(visibilityDict)) {
              allowedTaskSpaceIds.push(Number(spaceIdStr));
              if (Array.isArray(rootTaskIds) && rootTaskIds.length > 0) {
                rootTaskRestrictions[spaceIdStr] = rootTaskIds.map(Number);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching task visibility cache in ChatService:', err);
        }
      }

      // 3. Prepare payload for Python LangGraph backend
      const payload = {
        message,
        conversation_id: conversationId,
        user_id: user?.userId,
        user_email: user?.email,
        company_id: companyId,
        agent,
        context,
        scope: {
          allowed_ticket_space_ids: allowedTicketSpaceIds,
          allowed_task_space_ids: allowedTaskSpaceIds,
          root_task_restrictions: rootTaskRestrictions,
        },
      };

      // 4. Forward the request to the Python LangGraph backend as a stream
      const response = await axios.post(
        `${aiServiceUrl}/chat`,
        payload,
        {
          responseType: 'stream',
        },
      );
      return response.data;
    } catch (error) {
      console.error('Error proxying to LangGraph service:', error);
      throw new HttpException(
        'Failed to process chat with AI service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
