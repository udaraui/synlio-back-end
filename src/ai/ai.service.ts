import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';
import { getOrBuildVisibilityCache } from '../task-management/guards/visibility-cache.util';
import { TicketEntityResolverService } from './resolver/ticket-entity-resolver.service';
import { Transform } from 'stream';

@Injectable()
export class AiService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
    private readonly entityResolverService: TicketEntityResolverService,
  ) {}

  async processChat(
    message: string,
    conversationId?: string,
    user?: { userId?: number; email?: string; username?: string; privileges?: any[]; [key: string]: any },
    companyId: number = 0,
    agent?: string,
    context?: any,
    chatMode?: string,
    history?: Array<{ role: string; content: string }>,
    pendingDraft?: any,
  ): Promise<any> {
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL;

      // 1. Resolve accessible ticket spaces (from Redis cache or SQL fallback)
      let allowedTicketSpaceIds: number[] = [];
      let allowedSpaces: Array<{ id: number; name: string; prefix?: string }> = [];

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

        // Fetch space metadata (names and prefixes) for AI context and selection
        if (allowedTicketSpaceIds.length > 0) {
          const spaces = await this.entityManager.query(
            `SELECT "id", "name", "prefix" 
             FROM ticket_space 
             WHERE "companyId" = $1 AND "id" = ANY($2::int[])`,
            [companyId, allowedTicketSpaceIds]
          );
          allowedSpaces = spaces.map((s: any) => ({
            id: Number(s.id),
            name: s.name,
            prefix: s.prefix,
          }));
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
          console.error('Error fetching task visibility cache in AiService:', err);
        }
      }

      // 3. Evaluate Create Ticket Permission (Permission 103)
      const userPrivs = user?.privileges || [];
      const companyPriv = userPrivs.find((p: any) => Number(p.companyId) === Number(companyId));
      const privilegeIds: number[] = companyPriv?.privilegeIds || [];
      const canCreateTicket = privilegeIds.includes(103) || privilegeIds.length === 0 || !user?.privileges;

      // 4. Prepare payload for Python LangGraph backend
      const payload = {
        message,
        conversation_id: conversationId,
        user_id: user?.userId,
        user_email: user?.email,
        user_name: user?.username,
        chat_mode: chatMode || context?.chatMode || context?.mode || 'panel',
        company_id: companyId,
        agent,
        context,
        history,
        pending_draft: pendingDraft,
        pendingDraft: pendingDraft,
        scope: {
          allowed_ticket_space_ids: allowedTicketSpaceIds,
          allowed_task_space_ids: allowedTaskSpaceIds,
          allowed_spaces: allowedSpaces,
          root_task_restrictions: rootTaskRestrictions,
          can_create_ticket: canCreateTicket,
        },
      };

      // 5. Forward the request to the Python LangGraph backend as a stream
      const response = await axios.post(
        `${aiServiceUrl}/chat`,
        payload,
        {
          responseType: 'stream',
        },
      );

      // 6. Transparent Stream Transform with Entity Resolution
      const entityResolver = this.entityResolverService;
      let buffer = '';

      const transformStream = new Transform({
        async transform(chunk, encoding, callback) {
          const text = chunk.toString();
          buffer += text;

          // Check if buffer contains a draft payload marker
          if (buffer.includes('__DRAFT_PAYLOAD__')) {
            const parts = buffer.split('__DRAFT_PAYLOAD__');
            const beforeMarker = parts[0];
            const jsonPart = parts[1];

            try {
              const parsed = JSON.parse(jsonPart.trim());
              const targetDrafts = parsed.drafts && Array.isArray(parsed.drafts) && parsed.drafts.length > 0
                ? parsed.drafts
                : (parsed.draft || parsed);

              const { resolvedDraft, warnings } = await entityResolver.resolveDraftEntities(
                targetDrafts,
                companyId,
                allowedTicketSpaceIds,
                user,
              );

              const isArray = Array.isArray(resolvedDraft);
              const resolvedPayload = {
                action: parsed.action || 'CREATE_TICKET',
                status: parsed.status || 'READY',
                summary: parsed.summary,
                draft: isArray ? resolvedDraft[0] : resolvedDraft,
                drafts: isArray ? resolvedDraft : (parsed.drafts || [resolvedDraft]),
                warnings: [...(parsed.warnings || []), ...warnings],
                needs: parsed.needs || [],
              };

              this.push(beforeMarker);
              this.push(`__DRAFT_PAYLOAD__${JSON.stringify(resolvedPayload)}`);
              buffer = '';
              return callback();
            } catch {
              // Incomplete chunk, keep waiting in buffer
            }
          }

          this.push(chunk);
          callback();
        },
      });

      return response.data.pipe(transformStream);
    } catch (error) {
      console.error('Error proxying to LangGraph service:', error);
      throw new HttpException(
        'Failed to process chat with AI service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
