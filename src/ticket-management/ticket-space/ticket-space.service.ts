import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { TicketSpace } from './ticket-space.entity';
import {
  CreateTicketSpaceDto,
  UpdateTicketSpaceDto,
} from './dto/ticket-space.dto';
import { Status } from '../../common/status/status.entity';
import { TicketSpaceStatusConfig } from '../ticket-space-status-config/ticket-space-status-config.entity';
import { TicketSpaceSeverityConfig } from '../ticket-space-severity-config/ticket-space-severity-config.entity';
import { TicketSpaceTypeConfig } from '../ticket-space-type-config/ticket-space-type-config.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';
import { Severity } from '../../common/severity/severity.entity';
import { PostType } from '../../common/enum/post-type.enum';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { TicketType } from '../ticket-type/ticket-type.entity';
import { TicketImpact } from '../ticket-impact/ticket-impact.entity';
import { TicketSpaceMember } from '../ticket-space-member/ticket-space-member.entity';
import { Ticket } from '../ticket/ticket.entity';
import { User } from '../../user-management/user/user.entity';
import { SpaceAlertRule } from '../../alert/alert-rule/space-alert-rule.entity';
import {
  PostSequence,
  PostType as SequencePostType,
} from '../../common/sequence/post-sequence.entity';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TicketSpaceService implements OnModuleInit {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly redisService: RedisService,
  ) {}

  // ── Startup seeding ───────────────────────────────────────────────────

  async onModuleInit() {
    if (process.env.NODE_ENV === 'development') {
      console.log('SKIPPING - Redis cache seeding for ticket spaces in development environment.');
      return;
    }

    try {
      const spaces = await this.entityManager.find(TicketSpace, {
        select: ['id'],
      });
      console.log(
        `STARTING - Redis cache seeding for ${spaces.length} ticket spaces...`,
      );
      for (const space of spaces) {
        await this.seedSingleTicketSpaceCache(space.id!);
      }
      console.log(
        `FINISHED - Redis cache seeding for ${spaces.length} ticket spaces.`,
      );

      await this.seedAllTicketSpaceMemberships();
    } catch (err: any) {
      if ((err as any).code === '42P01') {
        console.warn(
          'ticket_space table not found yet - skipping startup cache seed.',
        );
      } else {
        console.error(
          'Error seeding ticket space cache on startup:',
          err,
        );
      }
    }
  }

  // ── Redis cache helpers ────────────────────────────────────────────────

  private async buildTicketSpaceConfigBlob(spaceId: number): Promise<object> {
    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where: { id: spaceId },
      relations: [
        'ticketQueues',
        'severityConfigs',
        'typeConfigs',
        'ticketImpacts',
        'members',
        'members.user',
        'statusConfigs',
      ],
      select: ['id', 'name', 'prefix', 'companyId', 'divisionId'],
    });

    if (!ticketSpace)
      throw new NotFoundException(`Ticket space with ID ${spaceId} not found`);

    //
    // const statusesWithSequence = await this.entityManager.query(
    //   `
    //   SELECT s.*, tss.sequence
    //   FROM status s
    //   INNER JOIN ticket_space_status tss ON s.id = tss."statusId"
    //   WHERE tss."ticketSpaceId" = $1
    //   ORDER BY tss.sequence ASC, s.id ASC
    // `,
    //   [spaceId],
    // );

    // const divisions = await this.entityManager.query(
    //   `
    //   SELECT id, division as name
    //   FROM division
    //   WHERE "companyId" = $1
    //   ORDER BY division ASC
    // `,
    //   [ticketSpace.companyId],
    // );

    // const members = (ticketSpace.members || []).map((permission) => ({
    //   ...permission,
    //   // profile_picture: permission.user?.profile_picture || null,
    // }));

    const slas = (ticketSpace.severityConfigs || [])
      .filter(c => c.responseTimeInMinutes > 0 || c.resolutionTimeInMinutes > 0)
      .map(c => ({
        id: c.id,
        ticketSpaceId: c.ticketSpaceId,
        severityId: c.id,
        responseTime: c.responseTimeInMinutes,
        resolutionTime: c.resolutionTimeInMinutes,
        severity: {
          id: c.id,
          name: c.name,
          color: c.color
        }
      }));

    return {
      ticketSpace: {
        id: ticketSpace.id,
        name: ticketSpace.name,
        prefix: ticketSpace.prefix,
        companyId: ticketSpace.companyId,
        divisionId: ticketSpace.divisionId,
      },
      statuses: ticketSpace.statusConfigs || [],
      severity: ticketSpace.severityConfigs || [],
      type: ticketSpace.typeConfigs || [],
      slas,
      impacts: ticketSpace.ticketImpacts || [],
      queues: ticketSpace.ticketQueues || [],
      // departments: divisions || [],
      members: ticketSpace.members,
    };
  }

  private async seedAllTicketSpaceMemberships() {
    try {
      const queryStr = `SELECT "userId", "ticketSpaceId" FROM ticket_space_member`;
      const rows = await this.entityManager.query(queryStr);

      const userMap = new Map<number, Set<number>>();
      for (const row of rows) {
        if (!userMap.has(row.userId)) {
          userMap.set(row.userId, new Set());
        }
        userMap.get(row.userId)!.add(row.ticketSpaceId);
      }

      console.log(`STARTING - Redis cache seeding for ${rows.length} ticket space memberships`);
      for (const [userId, spaceIds] of userMap.entries()) {
        await this.redisService.setTicketSpaceMemberships(userId, Array.from(spaceIds));
      }
      console.log(`FINISHED - Redis cache seeding for ${rows.length} ticket space memberships.`);
    } catch (err) {
      console.error('Failed to seed all ticket space memberships:', err);
    }
  }

  async seedSingleTicketSpaceCache(spaceId: number): Promise<void> {
    try {
      const blob = await this.buildTicketSpaceConfigBlob(spaceId);
      await this.redisService.setTicketSpaceConfig(spaceId, blob);
    } catch (err) {
      console.error(
        `[TicketSpaceService] Failed to seed Redis cache for ticket space ${spaceId}:`,
        err,
      );
    }
  }

  getAllTicketSpaces(activeCompanyId?: number, accessibleSpaceIds?: number[]) {
    const where: any = {};
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }
    if (accessibleSpaceIds) {
      where.id = In(accessibleSpaceIds);
    }

    return this.entityManager.find(TicketSpace, {
      where,
      order: { id: 'asc' },
      relations: [
        'company',
        'division',
        'ticketQueues',
        'statusConfigs',
        'severityConfigs',
        'typeConfigs',
        'ticketImpacts',
      ],
    });
  }

  async getTicketSpaceById(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: ['company', 'division'],
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    return ticketSpace;
  }

  async getTicketSpaceConfiguration(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    if (cached) {
      const c = cached as any;
      if (
        activeCompanyId &&
        activeCompanyId !== 0 &&
        c.ticketSpace?.companyId !== activeCompanyId
      ) {
        throw new NotFoundException(`Ticket space with ID ${id} not found`);
      }
      return {
        statuses: c.statuses || [],
        severities: c.severity || [],
        types: c.type || [],
        queues: c.queues || [],
      };
    }

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: [
        'company',
        'division',
        'ticketQueues',
        'statusConfigs',
        'severityConfigs',
        'typeConfigs',
        'ticketImpacts',
      ],
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    // Get statuses with sequence from join table
    const statusesWithSequence = await this.entityManager.query(
      `
      SELECT c.*, c.sequence
      FROM ticket_space_status_config c
      WHERE c."ticketSpaceId" = $1
      ORDER BY c.sequence ASC, c.id ASC
    `,
      [id],
    );

    // Seed cache for next time
    await this.seedSingleTicketSpaceCache(id);

    return {
      statuses: statusesWithSequence || [],
      severities: ticketSpace.severityConfigs || [],
      types: ticketSpace.typeConfigs || [],
      queues: ticketSpace.ticketQueues || [],
    };
  }

  // Fetch only status configuration
  async getTicketSpaceStatusConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    let statuses: any[] = [];
    
    if (cached && (cached as any).statuses) {
      statuses = (cached as any).statuses;
    } else {
      const where: any = { id };
      if (activeCompanyId && activeCompanyId !== 0) {
        where.companyId = activeCompanyId;
      }
      const ticketSpace = await this.entityManager.findOne(TicketSpace, {
        where,
        select: ['id', 'companyId'],
      });
      if (!ticketSpace) {
        throw new NotFoundException(`Ticket space with ID ${id} not found`);
      }

      statuses = await this.entityManager.query(
        `SELECT c.*, c.sequence
         FROM ticket_space_status_config c
         WHERE c."ticketSpaceId" = $1
         ORDER BY c.sequence ASC, c.id ASC`,
        [id],
      );
      if (statuses.length > 0) {
        await this.seedSingleTicketSpaceCache(id);
      }
    }

    if (statuses.length > 0) {
      const statusIds = statuses.map((s) => s.id);
      const counts = await this.entityManager.query(
        `SELECT "statusId", COUNT(*) as count FROM ticket WHERE "ticketSpaceId" = $1 AND "statusId" = ANY($2) GROUP BY "statusId"`,
        [id, statusIds]
      );
      const countMap = new Map(counts.map((c: any) => [c.statusId, parseInt(c.count, 10)]));
      statuses = statuses.map((s) => ({
        ...s,
        ticketCount: countMap.get(s.id) || 0,
      }));
      return { statuses, availableStatuses: [] };
    } else {
      // No configured statuses - return TKT-typed master statuses as availableStatuses
      const availableStatuses = await this.entityManager.find(Status, {
        where: { postType: PostType.TKT, isPrimaryBase: true },
        order: { id: 'ASC' },
        take: 5,
      });

      return {
        statuses: [],
        availableStatuses: availableStatuses,
      };
    }
  }

  // Fetch only severity configuration
  async getTicketSpaceSeverityConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    let severities: any[] = [];
    
    if (cached && (cached as any).severity) {
      severities = (cached as any).severity;
    } else {
      const where: any = { id };
      if (activeCompanyId && activeCompanyId !== 0) {
        where.companyId = activeCompanyId;
      }
      const ticketSpace = await this.entityManager.findOne(TicketSpace, {
        where,
        select: ['id', 'companyId'],
      });
      if (!ticketSpace) {
        throw new NotFoundException(`Ticket space with ID ${id} not found`);
      }

      severities = await this.entityManager.query(
        `SELECT c.* FROM ticket_space_severity_config c WHERE c."ticketSpaceId" = $1 ORDER BY c.id ASC`,
        [id],
      );
      if (severities.length > 0) {
        await this.seedSingleTicketSpaceCache(id);
      }
    }

    if (severities.length > 0) {
      const severityIds = severities.map((s) => s.id);
      const counts = await this.entityManager.query(
        `SELECT "severityId", COUNT(*) as count FROM ticket WHERE "ticketSpaceId" = $1 AND "severityId" = ANY($2) GROUP BY "severityId"`,
        [id, severityIds]
      );
      const countMap = new Map(counts.map((c: any) => [c.severityId, parseInt(c.count, 10)]));
      severities = severities.map((s) => ({
        ...s,
        ticketCount: countMap.get(s.id) || 0,
      }));
      return { severities, availableSeverities: [] };
    } else {
      // No configured severities - return TKT-typed master severities as availableSeverities
      const availableSeverities = await this.entityManager.find(Severity, {
        where: { postType: PostType.TKT },
        order: { id: 'ASC' },
        take: 4,
      });

      return {
        severities: [],
        availableSeverities: availableSeverities,
      };
    }
  }

  // Fetch only types configuration
  async getTicketSpaceTypesConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    let types: any[] = [];
    if (cached) {
      types = (cached as any).type || [];
    } else {
      const where: any = { id };
      if (activeCompanyId && activeCompanyId !== 0) {
        where.companyId = activeCompanyId;
      }

      const ticketSpace = await this.entityManager.findOne(TicketSpace, {
        where,
        relations: ['typeConfigs'],
        select: ['id'],
      });

      if (!ticketSpace) {
        throw new NotFoundException(`Ticket space with ID ${id} not found`);
      }

      types = ticketSpace.typeConfigs || [];
      if (types.length > 0) {
        await this.seedSingleTicketSpaceCache(id);
      }
    }

    if (types.length > 0) {
      const typeIds = types.map((t) => t.id);
      const counts = await this.entityManager.query(
        `SELECT "ticketTypeId", COUNT(*) as count FROM ticket WHERE "ticketSpaceId" = $1 AND "ticketTypeId" = ANY($2) GROUP BY "ticketTypeId"`,
        [id, typeIds]
      );
      const countMap = new Map(counts.map((c: any) => [c.ticketTypeId, parseInt(c.count, 10)]));
      types = types.map((t) => ({
        ...t,
        ticketCount: countMap.get(t.id) || 0,
      }));
    }

    // Get ticket types (TicketType is a global entity, not company-specific)
    const allTicketTypes = await this.entityManager.find(TicketType, {
      order: { name: 'ASC' },
      take: 3,
    });

    return {
      types,
      availableTypes: allTicketTypes || [],
    };
  }

  // Fetch only SLA configuration
  async getTicketSpaceSlaConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    if (cached) return { slas: (cached as any).slas || [] };

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: ['severityConfigs'],
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    const slas = (ticketSpace.severityConfigs || [])
      .filter(c => c.responseTimeInMinutes > 0 || c.resolutionTimeInMinutes > 0)
      .map(c => ({
        id: c.id,
        ticketSpaceId: c.ticketSpaceId,
        severityId: c.id,
        responseTime: c.responseTimeInMinutes,
        resolutionTime: c.resolutionTimeInMinutes,
        severity: {
          id: c.id,
          name: c.name,
          color: c.color
        }
      }));

    await this.seedSingleTicketSpaceCache(id);

    return { slas };
  }

  // Fetch only impact configuration
  async getTicketSpaceImpactConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    if (cached) return { impacts: (cached as any).impacts || [] };

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: ['ticketImpacts'],
      select: ['id'],
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    if (ticketSpace.ticketImpacts && ticketSpace.ticketImpacts.length > 0) {
      await this.seedSingleTicketSpaceCache(id);
    }

    return {
      impacts: ticketSpace.ticketImpacts || [],
    };
  }

  // Fetch only queue configuration
  async getTicketSpaceQueueConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    if (cached) return { queues: (cached as any).queues || [] };

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: ['ticketQueues'],
      select: ['id', 'companyId'],
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    if (ticketSpace.ticketQueues && ticketSpace.ticketQueues.length > 0) {
      await this.seedSingleTicketSpaceCache(id);
    }

    // Return all queues associated with this ticket space
    return {
      queues: ticketSpace.ticketQueues || [],
    };
  }

  // Fetch only members configuration
  async getTicketSpaceMembersConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    if (cached) return { members: (cached as any).members || [] };

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: ['members'],
      select: ['id'],
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    if (ticketSpace.members && ticketSpace.members.length > 0) {
      await this.seedSingleTicketSpaceCache(id);
    }

    return {
      members: (ticketSpace.members || []) as any[],
    };
  }

  // Optimized endpoint to get all configuration needed for creating a ticket
  async getTicketSpaceCreateConfig(id: number, activeCompanyId?: number) {
    const cached = await this.redisService.getTicketSpaceConfig(id);
    if (cached) {
      const c = cached as any;
      if (
        activeCompanyId &&
        activeCompanyId !== 0 &&
        c.ticketSpace?.companyId !== activeCompanyId
      ) {
        throw new NotFoundException(`Ticket space with ID ${id} not found`);
      }
      return c;
    }

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
      const count = await this.entityManager.count(TicketSpace, { where });
      if (count === 0)
        throw new NotFoundException(`Ticket space with ID ${id} not found`);
    }

    await this.seedSingleTicketSpaceCache(id);
    return await this.buildTicketSpaceConfigBlob(id);
  }

  async checkPrefixExists(
    companyId: number,
    prefix: string,
  ): Promise<{ exists: boolean }> {
    const existingSpace = await this.entityManager.findOne(TicketSpace, {
      where: {
        companyId: companyId,
        prefix: prefix.toUpperCase(),
      },
    });
    return { exists: !!existingSpace };
  }

  getAllTicketSpacesByCompanyId(companyId: number) {
    return this.entityManager.find(TicketSpace, {
      where: { companyId: companyId },
      order: { id: 'asc' },
      relations: [
        'company',
        'ticketQueue',
        'statusConfigs',
        'severityConfigs',
        'typeConfigs',
        'ticketImpacts',
      ],
    });
  }

  // ── Default seed helpers ─────────────────────────────────────────────────

  private async seedDefaultTicketSpaceConfigs(
    spaceId: number,
    companyId: number,
    em?: EntityManager,
  ) {
    const mgr = em ?? this.entityManager;
    // Statuses: up to 5 TKT-typed statuses for the company
    const statuses = await mgr.find(Status, {
      where: { postType: PostType.TKT, isPrimaryBase: true },
      order: { id: 'ASC' },
      take: 5,
    });
    for (let i = 0; i < statuses.length; i++) {
      await mgr.query(
        `INSERT INTO ticket_space_status_config ("ticketSpaceId","sequence","name","color","base","isPrimaryBase","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [spaceId, i, statuses[i].name, statuses[i].color, statuses[i].base, statuses[i].isPrimaryBase],
      );
    }

    // Severities: up to 4 TKT-typed severities for the company
    const severities = await mgr.find(Severity, {
      where: { postType: PostType.TKT },
      order: { id: 'ASC' },
      take: 4,
    });
    for (const sev of severities) {
      await mgr.query(
        `INSERT INTO ticket_space_severity_config ("ticketSpaceId", "name", "color", "responseTimeInMinutes", "resolutionTimeInMinutes")
         VALUES ($1, $2, $3, $4, $5)`,
        [spaceId, sev.name, sev.color || '#6366f1', 0, 0],
      );
    }

    // Ticket Types: up to 3 global ticket types
    const types = await mgr.find(TicketType, {
      order: { id: 'ASC' },
      take: 3,
    });
    for (const t of types) {
      await mgr.query(
        `INSERT INTO ticket_space_type_config ("ticketSpaceId", "sequence", "name", "color", "icon")
         VALUES ($1, $2, $3, $4, $5)`,
        [spaceId, 0, t.name, t.color || '#6366f1', t.icon],
      );
    }
  }

  async createTicketSpace(
    ticketSpaceDto: CreateTicketSpaceDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const newTicketSpace = new TicketSpace();

    // Security: If not system admin, force the space to the active company
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : ticketSpaceDto.companyId;

    Object.assign(newTicketSpace, {
      name: ticketSpaceDto.name,
      prefix: ticketSpaceDto.prefix,
      description: ticketSpaceDto.description,
      companyId: targetCompanyId,
      divisionId: ticketSpaceDto.divisionId,
    });
    newTicketSpace.createdBy = authUser.email;

    // Handle many-to-many relationships
    if (ticketSpaceDto.ticketQueueIds?.length) {
      newTicketSpace.ticketQueues = await this.entityManager.findBy(
        TicketQueue,
        {
          id: In(ticketSpaceDto.ticketQueueIds),
        },
      );
    }

    if (ticketSpaceDto.ticketStatusIds?.length) {
      const statuses = await this.entityManager.findBy(Status, {
        id: In(ticketSpaceDto.ticketStatusIds),
      });
      newTicketSpace.statusConfigs = statuses.map((status, index) => {
        const config = new TicketSpaceStatusConfig();
        config.sequence = index;
        config.name = status.name;
        config.color = status.color;
        config.base = status.base ?? StatusBaseEnum.TOSTART;
        config.isPrimaryBase = status.isPrimaryBase ?? false;
        return config;
      });
    }

    // if (ticketSpaceDto.ticketSeverityIds?.length) {
    //   newTicketSpace.severityConfigs = await this.entityManager.findBy(
    //     TicketSpaceSeverityConfig,
    //     {
    //       id: In(ticketSpaceDto.ticketSeverityIds),
    //     },
    //   );
    // }

    // if (ticketSpaceDto.ticketTypeIds?.length) {
    //   newTicketSpace.typeConfigs = await this.entityManager.findBy(TicketSpaceTypeConfig, {
    //     id: In(ticketSpaceDto.ticketTypeIds),
    //   });
    // }

    // if (ticketSpaceDto.ticketSlaIds?.length) {
    //   newTicketSpace.ticketSlas = await this.entityManager.findBy(TicketSla, {
    //     id: In(ticketSpaceDto.ticketSlaIds),
    //   });
    // }

    if (ticketSpaceDto.ticketImpactIds?.length) {
      newTicketSpace.ticketImpacts = await this.entityManager.findBy(
        TicketImpact,
        {
          id: In(ticketSpaceDto.ticketImpactIds),
        },
      );
    }

    // Save the ticket space first
    const savedTicketSpace = await this.entityManager.save(
      TicketSpace,
      newTicketSpace,
    );

    // Auto-create the Default alert rule (mirrors legacy hardcoded behaviour)
    try {
      const defaultRule = this.entityManager.create(SpaceAlertRule, {
        name: 'Default',
        spaceType: 'ticket',
        spaceId: savedTicketSpace.id!,
        events: [
          'TICKET_CREATED',
          'TICKET_UPDATED',
          'TICKET_ASSIGNED',
          'STATUS_CHANGED',
          'SEVERITY_CHANGED',
          'QUEUE_CHANGED',
          'NAME_CHANGED',
          'COMMENT_ADDED',
          'TICKET_DELETED',
        ],
        channel: 'both',
        toAssignee: true,
        toCoAssignees: false,
        toParticipants: true,
        toCreator: true,
        toActor: true,
        toAdditionalUserIds: [],
        ccAssignee: false,
        ccCoAssignees: false,
        ccParticipants: false,
        ccCreator: false,
        ccActor: false,
        ccAdditionalUserIds: [],
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        createdBy: authUser.email as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        updatedBy: authUser.email as string,
      });
      await this.entityManager.save(SpaceAlertRule, defaultRule);
    } catch (ruleErr) {
      // Don't fail space creation if rule seeding fails
      console.error(
        'Failed to create default alert rule for ticket space:',
        ruleErr,
      );
    }

    // Auto-create default PostSequence record
    try {
      const sequence = new PostSequence();
      sequence.companyId = targetCompanyId;
      sequence.spaceId = savedTicketSpace.id!;
      sequence.postType = SequencePostType.TKT;
      sequence.levelPrefix = savedTicketSpace.prefix;
      sequence.nextNumber = 1;
      sequence.createdBy = authUser.email as string;
      await this.entityManager.save(PostSequence, sequence);
    } catch (seqErr) {
      console.error(
        'Failed to create default sequence for ticket space:',
        seqErr,
      );
    }

    // Automatically create owner permission for the creator
    let user: User | null = null;
    try {
      // Find the user by email (case-insensitive)
      user = await this.entityManager
        .createQueryBuilder(User, 'user')
        .where('LOWER(user.email) = LOWER(:email)', { email: authUser.email as string })
        .getOne();

      // // Find or create the Owner role in Ticket Management group
      // let ownerRole = await this.entityManager.findOne(Role, {
      //   where: {
      //     role: 'Owner',
      //     group: 'Ticket Management',
      //     companyId: savedTicketSpace.companyId,
      //   },
      // });

      // // If Owner role doesn't exist, create it
      // if (!ownerRole) {
      //   const newOwnerRole = new Role();
      //   newOwnerRole.role = 'Owner';
      //   newOwnerRole.group = 'Ticket Management';
      //   newOwnerRole.companyId = savedTicketSpace.companyId;
      //   newOwnerRole.isActive = true;
      //   newOwnerRole.createdAt = new Date();
      //   newOwnerRole.createdBy = 'system';
      //   ownerRole = await this.entityManager.save(Role, newOwnerRole);
      // }

      // Create the Default queue for this ticket space
      let defaultQueue: TicketQueue | null = null;
      try {
        const newDefaultQueue = new TicketQueue();
        newDefaultQueue.ticketSpaceId = savedTicketSpace.id!;
        newDefaultQueue.name = 'Default';
        newDefaultQueue.description = 'Default queue';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        newDefaultQueue.createdBy = authUser.email as string;
        defaultQueue = await this.entityManager.save(
          TicketQueue,
          newDefaultQueue,
        );

        // Link queue to ticket space via join table
        await this.entityManager.query(
          `INSERT INTO ticket_space_queue ("ticketSpaceId", "ticketQueueId") VALUES ($1, $2)`,
          [savedTicketSpace.id, defaultQueue.id],
        );
      } catch (queueError) {
        console.error('Failed to create Default queue:', queueError);
      }

      if (user) {
        // Create owner permission and assign Default queue
        const ownerPermission = new TicketSpaceMember();
        ownerPermission.ticketSpaceId = savedTicketSpace.id!;
        ownerPermission.userId = user.id!;
        ownerPermission.userFirstName = user.first_name;
        ownerPermission.userLastName = user.last_name;
        ownerPermission.userEmail = user.email;
        ownerPermission.userProfilePicture = user.profile_picture;
        ownerPermission.queues = defaultQueue ? [defaultQueue] : [];
        ownerPermission.createdBy = authUser.email as string;

        await this.entityManager.save(TicketSpaceMember, ownerPermission);
      }
    } catch (error) {
      // Log error but don't fail the ticket space creation
      console.error('Failed to create owner permission:', error);
    }

    // Seed default statuses, severities, and ticket types when the DTO
    // didn't supply explicit IDs (i.e. a plain create from the UI)
    // if (
    //   !ticketSpaceDto.ticketStatusIds?.length &&
    //   !ticketSpaceDto.ticketSeverityIds?.length &&
    //   !ticketSpaceDto.ticketTypeIds?.length
    // ) {
    try {
      await this.seedDefaultTicketSpaceConfigs(
        savedTicketSpace.id!,
        savedTicketSpace.companyId,
      );
    } catch (seedErr) {
      console.error(
        'Failed to seed default configs for ticket space:',
        seedErr,
      );
    }
    // }

    // Seed Redis cache for the new space (after seeding default configs above)
    await this.seedSingleTicketSpaceCache(savedTicketSpace.id!);

    if (user) {
      await this.redisService.invalidateUserTicketSpaces(user.id!);
    }

    return savedTicketSpace;
  }

  async updateTicketSpace(
    id: number,
    ticketSpaceDto: UpdateTicketSpaceDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<TicketSpace> {
    const where: any = { id: id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existingTicketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
      relations: [
        'ticketQueues',
        'statusConfigs',
        'severityConfigs',
        'typeConfigs',
        'ticketImpacts',
      ],
    });

    if (!existingTicketSpace) {
      throw new NotFoundException(`Ticket Space with ID ${id} not found`);
    }

    // Update basic fields
    if (ticketSpaceDto.name) existingTicketSpace.name = ticketSpaceDto.name;
    if (ticketSpaceDto.prefix)
      existingTicketSpace.prefix = ticketSpaceDto.prefix;
    if (ticketSpaceDto.description !== undefined)
      existingTicketSpace.description = ticketSpaceDto.description;
    if (ticketSpaceDto.companyId)
      existingTicketSpace.companyId = ticketSpaceDto.companyId;

    existingTicketSpace.updatedBy = authUser.email;

    // Update many-to-many relationships if provided
    if (ticketSpaceDto.ticketQueueIds !== undefined) {
      if (ticketSpaceDto.ticketQueueIds.length > 0) {
        existingTicketSpace.ticketQueues = await this.entityManager.findBy(
          TicketQueue,
          {
            id: In(ticketSpaceDto.ticketQueueIds),
          },
        );
      } else {
        existingTicketSpace.ticketQueues = [];
      }
    }

    if (ticketSpaceDto.ticketStatusIds !== undefined) {
      if (ticketSpaceDto.ticketStatusIds.length > 0) {
        const statuses = await this.entityManager.findBy(
          Status,
          {
            id: In(ticketSpaceDto.ticketStatusIds),
          },
        );
        existingTicketSpace.statusConfigs = statuses.map((status, index) => {
          const config = new TicketSpaceStatusConfig();
          config.sequence = index;
          config.name = status.name;
          config.color = status.color;
          config.base = status.base ?? StatusBaseEnum.TOSTART;
          config.isPrimaryBase = status.isPrimaryBase ?? false;
          return config;
        });
      } else {
        existingTicketSpace.statusConfigs = [];
      }
    }

    // if (ticketSpaceDto.ticketSeverityIds !== undefined) {
    //   if (ticketSpaceDto.ticketSeverityIds.length > 0) {
    //     existingTicketSpace.severityConfigs = await this.entityManager.findBy(
    //       TicketSpaceSeverityConfig,
    //       {
    //         id: In(ticketSpaceDto.ticketSeverityIds),
    //       },
    //     );
    //   } else {
    //     existingTicketSpace.severityConfigs = [];
    //   }
    // }

    // if (ticketSpaceDto.ticketTypeIds !== undefined) {
    //   if (ticketSpaceDto.ticketTypeIds.length > 0) {
    //     existingTicketSpace.typeConfigs = await this.entityManager.findBy(
    //       TicketSpaceTypeConfig,
    //       {
    //         id: In(ticketSpaceDto.ticketTypeIds),
    //       },
    //     );
    //   } else {
    //     existingTicketSpace.typeConfigs = [];
    //   }
    // }

    // if (ticketSpaceDto.ticketSlaIds !== undefined) {
    //   if (ticketSpaceDto.ticketSlaIds.length > 0) {
    //     existingTicketSpace.ticketSlas = await this.entityManager.findBy(
    //       TicketSla,
    //       {
    //         id: In(ticketSpaceDto.ticketSlaIds),
    //       },
    //     );
    //   } else {
    //     existingTicketSpace.ticketSlas = [];
    //   }
    // }

    if (ticketSpaceDto.ticketImpactIds !== undefined) {
      if (ticketSpaceDto.ticketImpactIds.length > 0) {
        existingTicketSpace.ticketImpacts = await this.entityManager.findBy(
          TicketImpact,
          {
            id: In(ticketSpaceDto.ticketImpactIds),
          },
        );
      } else {
        existingTicketSpace.ticketImpacts = [];
      }
    }

    // Note: Members are now managed through TicketSpaceMember entity
    // Use the ticket permission endpoints to add/remove/update members

    const updatedTicketSpace = await this.entityManager.save(existingTicketSpace);
    await this.redisService.deleteTicketSpaceConfig(id);
    await this.seedSingleTicketSpaceCache(id);
    return updatedTicketSpace;
  }

  async toggleIsActive(
    id: number,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ message: string; isActive: boolean }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const space = await this.entityManager.findOne(TicketSpace, { where });
    if (!space) {
      throw new NotFoundException(`TicketSpace with ID ${id} not found`);
    }

    space.isActive = !space.isActive;
    await this.entityManager.save(TicketSpace, space);

    // Seed Redis cache for the updated space
    await this.seedSingleTicketSpaceCache(space.id!);

    if (authUser) {
      await this.redisService.invalidateUserTicketSpaces(authUser.id!);
    }

    return {
      message: `Ticket space ${space.isActive ? 'enabled' : 'disabled'}`,
      isActive: space.isActive,
    };
  }

  async deleteTicketSpace(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(`Ticket Space with ID ${id} not found`);
    }

    // Check if there are any tickets associated with this ticket space
    const tickets = await this.entityManager.find(Ticket, {
      where: { ticketSpaceId: id },
      select: ['id', 'code', 'name'],
      take: 5, // Only get first 5 tickets for the error message
    });

    if (tickets.length > 0) {
      const ticketCodes = tickets.map((t) => t.code).join(', ');
      const totalCount = await this.entityManager.count(Ticket, {
        where: { ticketSpaceId: id },
      });

      throw new BadRequestException(
        `Cannot delete ticket space. This space has ${totalCount} ticket(s). ` +
          `Tickets: ${ticketCodes}${totalCount > 5 ? '...' : ''}. ` +
          `Please delete or move the tickets first`,
      );
    }

    // Fetch members before deleting so we can invalidate their caches
    const members = await this.entityManager.find(TicketSpaceMember, {
      where: { ticketSpaceId: id },
      select: ['userId'],
    });
    const memberIds = members.map((m) => m.userId);

    await this.entityManager.delete(TicketSpace, id);

    await this.redisService.deleteTicketSpaceConfig(id);

    // Invalidate caches for all members
    for (const userId of memberIds) {
      if (userId) void this.redisService.invalidateUserTicketSpaces(userId);
    }

    return {
      message: 'Ticket Space deleted',
      status: 200,
    };
  }

  async addStatusToSpace(
    ticketSpaceId: number,
    statusName: string,
    color: string,
    authUser: any,
    base?: StatusBaseEnum | null,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const savedStatus = await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Check if already in config
      const alreadyLinked = await em.query(
        `SELECT 1 FROM ticket_space_status_config WHERE "ticketSpaceId" = $1 AND name = $2`,
        [ticketSpaceId, statusName],
      );
      if (alreadyLinked.length > 0)
        throw new BadRequestException('Status already added to this ticket space');

      // Calculate optimal insertion index
      const existingConfigs = await em.query(
        `SELECT id, base, sequence FROM ticket_space_status_config WHERE "ticketSpaceId" = $1 ORDER BY sequence ASC`,
        [ticketSpaceId]
      );
      
      const newBase = base ?? StatusBaseEnum.TOSTART;
      const baseOrder: Record<string, number> = { 'To Start': 1, 'Processing': 2, 'Finished': 3 };
      const newBaseValue = baseOrder[newBase] || 4;
      
      let insertIndex = existingConfigs.length;
      const lastSameBaseIndex = existingConfigs.map((c: any) => c.base).lastIndexOf(newBase);
      
      if (lastSameBaseIndex !== -1) {
        insertIndex = lastSameBaseIndex + 1;
      } else {
        let found = false;
        for (let i = existingConfigs.length - 1; i >= 0; i--) {
           const existingBaseValue = baseOrder[existingConfigs[i].base] || 4;
           if (existingBaseValue < newBaseValue) {
             insertIndex = i + 1;
             found = true;
             break;
           }
        }
        if (!found) insertIndex = 0;
      }

      // Add to ticket_space_status_config
      const insertResult = await em.query(
        `INSERT INTO ticket_space_status_config ("ticketSpaceId", "sequence", "name", "color", "base", "isPrimaryBase", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW()) RETURNING *`,
        [ticketSpaceId, -1, statusName, color, newBase],
      );

      existingConfigs.splice(insertIndex, 0, { id: insertResult[0].id });
      for (let i = 0; i < existingConfigs.length; i++) {
        await em.query(
          `UPDATE ticket_space_status_config SET sequence = $1 WHERE id = $2`,
          [i, existingConfigs[i].id]
        );
      }
      insertResult[0].sequence = insertIndex;

      return { ...insertResult[0] };
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return savedStatus;
  }

  async addExistingStatusToSpace(
    ticketSpaceId: number,
    statusId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Verify the status exists (no company constraint)
    const status = await this.entityManager.findOne(Status, {
      where: { id: statusId },
    });

    if (!status) {
      throw new NotFoundException(
        `Status with ID ${statusId} not found`,
      );
    }

    // Check if already added
    const existing = await this.entityManager.query(
      `SELECT 1 FROM ticket_space_status_config WHERE "ticketSpaceId" = $1 AND name = $2`,
      [ticketSpaceId, status.name],
    );

    if (existing.length > 0) {
      throw new Error('Status is already added to this ticket space');
    }

    await this.entityManager.transaction(async (em) => {
      const existingConfigs = await em.query(
        `SELECT id, base, sequence FROM ticket_space_status_config WHERE "ticketSpaceId" = $1 ORDER BY sequence ASC`,
        [ticketSpaceId]
      );
      
      const newBase = status.base ?? StatusBaseEnum.TOSTART;
      const baseOrder: Record<string, number> = { 'To Start': 1, 'Processing': 2, 'Finished': 3 };
      const newBaseValue = baseOrder[newBase] || 4;
      
      let insertIndex = existingConfigs.length;
      const lastSameBaseIndex = existingConfigs.map((c: any) => c.base).lastIndexOf(newBase);
      
      if (lastSameBaseIndex !== -1) {
        insertIndex = lastSameBaseIndex + 1;
      } else {
        let found = false;
        for (let i = existingConfigs.length - 1; i >= 0; i--) {
           const existingBaseValue = baseOrder[existingConfigs[i].base] || 4;
           if (existingBaseValue < newBaseValue) {
             insertIndex = i + 1;
             found = true;
             break;
           }
        }
        if (!found) insertIndex = 0;
      }

      // Add to ticket_space_status_config
      const insertResult = await em.query(
        `INSERT INTO ticket_space_status_config ("ticketSpaceId", "sequence", "name", "color", "base", "isPrimaryBase", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
        [ticketSpaceId, -1, status.name, status.color, newBase, status.isPrimaryBase ?? false],
      );

      existingConfigs.splice(insertIndex, 0, { id: insertResult[0].id });
      for (let i = 0; i < existingConfigs.length; i++) {
        await em.query(
          `UPDATE ticket_space_status_config SET sequence = $1 WHERE id = $2`,
          [i, existingConfigs[i].id]
        );
      }
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return status;
  }

  async updateSpaceStatus(
    ticketSpaceId: number,
    statusId: number,
    dto: { name?: string; color?: string },
    authUser: any,
  ) {
    const config = await this.entityManager.query(
      `SELECT * FROM ticket_space_status_config WHERE "ticketSpaceId"=$1 AND id=$2`,
      [ticketSpaceId, statusId],
    );
    if (config.length === 0)
      throw new NotFoundException('Status not found in this ticket space');

    const updateClauses: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updateClauses.push(`name = $${paramIndex++}`);
      updateValues.push(dto.name);
    }
    if (dto.color !== undefined) {
      updateClauses.push(`color = $${paramIndex++}`);
      updateValues.push(dto.color);
    }

    if (updateClauses.length > 0) {
      updateValues.push(ticketSpaceId, statusId);
      const [updated] = await this.entityManager.query(
        `UPDATE ticket_space_status_config SET ${updateClauses.join(', ')} WHERE "ticketSpaceId"=$${paramIndex++} AND id=$${paramIndex++} RETURNING *`,
        updateValues,
      );
      
      // Update all tickets in this space using this status
      await this.entityManager.query(
        `UPDATE ticket SET "statusName" = $1, "statusColor" = $2 WHERE "ticketSpaceId" = $3 AND "statusId" = $4`,
        [updated.name, updated.color, ticketSpaceId, statusId],
      );
      
      await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
      return updated;
    }
    
    return config[0];
  }

  async removeStatusFromSpace(
    ticketSpaceId: number,
    statusId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Check if any tickets in this space are using the status
    const [{ count }] = await this.entityManager.query(
      `SELECT COUNT(*) as count FROM ticket WHERE "ticketSpaceId" = $1 AND "statusId" = $2`,
      [ticketSpaceId, statusId],
    );
    if (parseInt(count, 10) > 0)
      throw new BadRequestException(
        `Cannot remove this status because it is currently assigned to ${count} ticket(s) in this space`,
      );

    // Check if it is a primary status
    const [statusConfig] = await this.entityManager.query(
      `SELECT "isPrimaryBase" FROM ticket_space_status_config WHERE "ticketSpaceId" = $1 AND id = $2`,
      [ticketSpaceId, statusId],
    );
    if (statusConfig && statusConfig.isPrimaryBase) {
      throw new BadRequestException(`Cannot remove a primary status from the space`);
    }

    // Remove from ticket_space_status_config
    await this.entityManager.query(
      `DELETE FROM ticket_space_status_config WHERE "ticketSpaceId" = $1 AND id = $2`,
      [ticketSpaceId, statusId],
    );

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return {
      message: 'Status removed from ticket space',
      status: 200,
    };
  }

  async updateStatusSequence(
    ticketSpaceId: number,
    statusSequences: { statusId: number; sequence: number }[],
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Update sequences in batch
    await this.entityManager.transaction(async (transactionalEntityManager) => {
      for (const item of statusSequences) {
        await transactionalEntityManager.query(
          `UPDATE ticket_space_status_config SET sequence = $1 WHERE "ticketSpaceId" = $2 AND id = $3`,
          [item.sequence, ticketSpaceId, item.statusId],
        );
      }
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return {
      message: 'Status sequences updated',
      status: 200,
    };
  }

  // Severity Management Methods
  async addSeverityToSpace(
    ticketSpaceId: number,
    severityName: string,
    color: string,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const savedSeverity = await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Create new severity
      const newSeverityConfig = new TicketSpaceSeverityConfig();
      newSeverityConfig.ticketSpaceId = ticketSpaceId;
      newSeverityConfig.name = severityName;
      newSeverityConfig.color = color;
      newSeverityConfig.responseTimeInMinutes = 0;
      newSeverityConfig.resolutionTimeInMinutes = 0;
      const savedSeverity = await em.save(TicketSpaceSeverityConfig, newSeverityConfig);

      return savedSeverity;
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return savedSeverity;
  }

  async addExistingSeverityToSpace(
    ticketSpaceId: number,
    severityId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Verify the severity exists and belongs to the same company
    const severity = await this.entityManager.findOne(Severity, {
      where: { id: severityId },
    });

    if (!severity) {
      throw new NotFoundException(
        `Severity with ID ${severityId} not found or does not belong to this company`,
      );
    }

    // Check if already added
    const existing = await this.entityManager.findOne(TicketSpaceSeverityConfig, {
      where: { ticketSpaceId, name: severity.name }
    });

    if (existing) {
      throw new BadRequestException('A severity with this name already exists in this ticket space');
    }

    // Add to ticket_space_severity
    const newSeverityConfig = new TicketSpaceSeverityConfig();
    newSeverityConfig.ticketSpaceId = ticketSpaceId;
    newSeverityConfig.name = severity.name;
    newSeverityConfig.color = severity.color;
    newSeverityConfig.responseTimeInMinutes = 0;
    newSeverityConfig.resolutionTimeInMinutes = 0;
    const saved = await this.entityManager.save(TicketSpaceSeverityConfig, newSeverityConfig);

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return saved;
  }

  async updateSpaceSeverity(
    ticketSpaceId: number,
    severityId: number,
    dto: { name?: string; color?: string },
    authUser: any,
  ) {
    const config = await this.entityManager.query(
      `SELECT * FROM ticket_space_severity_config WHERE "ticketSpaceId"=$1 AND id=$2`,
      [ticketSpaceId, severityId],
    );
    if (config.length === 0)
      throw new NotFoundException('Severity not found in this ticket space');

    const updateClauses: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updateClauses.push(`name = $${paramIndex++}`);
      updateValues.push(dto.name);
    }
    if (dto.color !== undefined) {
      updateClauses.push(`color = $${paramIndex++}`);
      updateValues.push(dto.color);
    }

    if (updateClauses.length > 0) {
      updateValues.push(ticketSpaceId, severityId);
      const [updated] = await this.entityManager.query(
        `UPDATE ticket_space_severity_config SET ${updateClauses.join(', ')} WHERE "ticketSpaceId"=$${paramIndex++} AND id=$${paramIndex++} RETURNING *`,
        updateValues,
      );
      
      // Update all tickets in this space using this severity
      await this.entityManager.query(
        `UPDATE ticket SET "severityName" = $1, "severityColor" = $2 WHERE "ticketSpaceId" = $3 AND "severityId" = $4`,
        [updated.name, updated.color, ticketSpaceId, severityId],
      );
      
      await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
      return updated;
    }
    
    return config[0];
  }

  async removeSeverityFromSpace(
    ticketSpaceId: number,
    severityId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Check if any tickets in this space are using the severity
    const [{ count }] = await this.entityManager.query(
      `SELECT COUNT(*) as count FROM ticket WHERE "ticketSpaceId" = $1 AND "severityId" = $2`,
      [ticketSpaceId, severityId],
    );
    if (parseInt(count, 10) > 0)
      throw new BadRequestException(
        `Cannot remove this severity because it is currently assigned to ${count} ticket(s) in this space`,
      );

    // Remove from ticket_space_severity_config
    await this.entityManager.delete(TicketSpaceSeverityConfig, { id: severityId, ticketSpaceId });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return {
      message: 'Severity removed from ticket space',
      status: 200,
    };
  }

  // Type management methods
  async addTypeToSpace(
    ticketSpaceId: number,
    name: string,
    icon: string,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const savedType = await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Create new ticket type
      const newTypeConfig = new TicketSpaceTypeConfig();
      newTypeConfig.ticketSpaceId = ticketSpaceId;
      newTypeConfig.name = name;
      newTypeConfig.icon = icon;
      newTypeConfig.color = '#3B82F6'; // Default color
      newTypeConfig.sequence = 0;
      const savedType = await em.save(TicketSpaceTypeConfig, newTypeConfig);

      return savedType;
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return savedType;
  }

  async addExistingTypeToSpace(
    ticketSpaceId: number,
    typeId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Verify the type exists
    const type = await this.entityManager.findOne(TicketType, {
      where: { id: typeId },
    });

    if (!type) {
      throw new NotFoundException(`Type with ID ${typeId} not found`);
    }

    // Check if already added
    const existing = await this.entityManager.findOne(TicketSpaceTypeConfig, {
      where: { ticketSpaceId, name: type.name }
    });

    if (existing) {
      throw new BadRequestException('A type with this name already exists in this ticket space');
    }

    // Add to ticket_space_type
    const newTypeConfig = new TicketSpaceTypeConfig();
    newTypeConfig.ticketSpaceId = ticketSpaceId;
    newTypeConfig.name = type.name;
    newTypeConfig.icon = type.icon;
    newTypeConfig.color = type.color;
    newTypeConfig.sequence = 0;
    const saved = await this.entityManager.save(TicketSpaceTypeConfig, newTypeConfig);

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return saved;
  }

  async updateSpaceType(
    ticketSpaceId: number,
    typeId: number,
    dto: { name?: string; icon?: string },
    authUser: any,
  ) {
    const config = await this.entityManager.query(
      `SELECT * FROM ticket_space_type_config WHERE "ticketSpaceId"=$1 AND id=$2`,
      [ticketSpaceId, typeId],
    );
    if (config.length === 0)
      throw new NotFoundException('Type not found in this ticket space');

    const updateClauses: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updateClauses.push(`name = $${paramIndex++}`);
      updateValues.push(dto.name);
    }
    if (dto.icon !== undefined) {
      updateClauses.push(`icon = $${paramIndex++}`);
      updateValues.push(dto.icon);
    }

    if (updateClauses.length > 0) {
      updateValues.push(ticketSpaceId, typeId);
      const [updated] = await this.entityManager.query(
        `UPDATE ticket_space_type_config SET ${updateClauses.join(', ')} WHERE "ticketSpaceId"=$${paramIndex++} AND id=$${paramIndex++} RETURNING *`,
        updateValues,
      );
      
      // Update all tickets in this space using this type
      await this.entityManager.query(
        `UPDATE ticket SET "ticketTypeName" = $1, "ticketTypeIcon" = $2 WHERE "ticketSpaceId" = $3 AND "ticketTypeId" = $4`,
        [updated.name, updated.icon, ticketSpaceId, typeId],
      );
      
      await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
      return updated;
    }
    
    return config[0];
  }

  async removeTypeFromSpace(
    ticketSpaceId: number,
    typeId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Check if any tickets in this space are using the type
    const [{ count }] = await this.entityManager.query(
      `SELECT COUNT(*) as count FROM ticket WHERE "ticketSpaceId" = $1 AND "ticketTypeId" = $2`,
      [ticketSpaceId, typeId],
    );
    if (parseInt(count, 10) > 0)
      throw new BadRequestException(
        `Cannot remove this type because it is currently assigned to ${count} ticket(s) in this space`,
      );

    // Remove from ticket_space_type_config
    await this.entityManager.delete(TicketSpaceTypeConfig, { id: typeId, ticketSpaceId });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return {
      message: 'Type removed from ticket space',
      status: 200,
    };
  }

  async updateTypeSequence(
    ticketSpaceId: number,
    typeSequences: { typeId: number; order: number }[],
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where,
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // No order column needed - types don't require sequencing
    // Just return success
    return {
      message: 'Type sequence updated',
      status: 200,
    };
  }

  // SLA management methods
  async addSlaToSpace(
    ticketSpaceId: number,
    severityId: number,
    responseTime: number,
    resolutionTime: number,
    activeCompanyId?: number,
    authUser?: any,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, { where });
    if (!ticketSpace) throw new NotFoundException(`Ticket space with ID ${ticketSpaceId} not found`);

    const severityConfig = await this.entityManager.findOne(TicketSpaceSeverityConfig, {
      where: { id: severityId, ticketSpaceId }
    });

    if (!severityConfig) throw new NotFoundException(`Severity config with ID ${severityId} not found in this space`);

    severityConfig.responseTimeInMinutes = responseTime;
    severityConfig.resolutionTimeInMinutes = resolutionTime;
    await this.entityManager.save(TicketSpaceSeverityConfig, severityConfig);

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);

    return {
      id: severityConfig.id,
      ticketSpaceId,
      severityId: severityConfig.id,
      responseTime: severityConfig.responseTimeInMinutes,
      resolutionTime: severityConfig.resolutionTimeInMinutes,
    };
  }

  async removeSlaFromSpace(
    ticketSpaceId: number,
    slaId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticketSpace = await this.entityManager.findOne(TicketSpace, { where });
    if (!ticketSpace) throw new NotFoundException(`Ticket space with ID ${ticketSpaceId} not found`);

    const severityConfig = await this.entityManager.findOne(TicketSpaceSeverityConfig, {
      where: { id: slaId, ticketSpaceId }
    });

    if (!severityConfig) throw new NotFoundException(`SLA config with ID ${slaId} not found in this space`);

    severityConfig.responseTimeInMinutes = 0;
    severityConfig.resolutionTimeInMinutes = 0;
    await this.entityManager.save(TicketSpaceSeverityConfig, severityConfig);

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);

    return {
      message: 'SLA removed from ticket space',
      status: 200,
    };
  }

  // Impact management methods
  async addImpactToSpace(
    ticketSpaceId: number,
    name: string,
    description: string,
    activeCompanyId?: number,
    authUser?: any,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const savedImpact = await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Check if impact with same name already exists in this space
      const existingImpact = await em.findOne(TicketImpact, {
        where: { ticketSpaceId, name },
      });
      if (existingImpact)
        throw new BadRequestException(
          `Impact with name "${name}" already exists in this ticket space`,
        );

      // Create new impact with ticketSpaceId
      const newImpact = new TicketImpact();
      if (authUser?.email) {
        newImpact.createdBy = authUser.email;
      }
      newImpact.ticketSpaceId = ticketSpaceId;
      newImpact.name = name;
      newImpact.description = description;
      const savedImpact = await em.save(TicketImpact, newImpact);

      // Link to ticket space via join table
      await em.query(
        `INSERT INTO ticket_space_impact ("ticketSpaceId", "ticketImpactId") VALUES ($1, $2)`,
        [ticketSpaceId, savedImpact.id],
      );
      return savedImpact;
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return savedImpact;
  }

  async updateImpactInSpace(
    ticketSpaceId: number,
    impactId: number,
    name: string,
    description: string,
    activeCompanyId?: number,
    authUser?: any,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const updatedImpact = await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      const impact = await em.findOne(TicketImpact, { where: { id: impactId, ticketSpaceId } });
      if (!impact) {
        throw new NotFoundException(`Impact with ID ${impactId} not found in this space`);
      }

      // Check if another impact with the same name exists
      if (name !== impact.name) {
        const existingImpact = await em.findOne(TicketImpact, {
          where: { ticketSpaceId, name },
        });
        if (existingImpact)
          throw new BadRequestException(
            `Impact with name "${name}" already exists in this ticket space`,
          );
      }

      impact.name = name;
      impact.description = description;
      if (authUser?.email) {
        impact.updatedBy = authUser.email;
      }
      
      return await em.save(TicketImpact, impact);
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return updatedImpact;
  }

  async removeImpactFromSpace(
    ticketSpaceId: number,
    impactId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Remove from join table
      await em.query(
        `DELETE FROM ticket_space_impact WHERE "ticketSpaceId" = $1 AND "ticketImpactId" = $2`,
        [ticketSpaceId, impactId],
      );
      // Delete the impact itself
      await em.delete(TicketImpact, { id: impactId });
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return {
      message: 'Impact removed from ticket space',
      status: 200,
    };
  }

  // Queue management methods
  async addQueueToSpace(
    ticketSpaceId: number,
    name: string,
    activeCompanyId?: number,
    authUser?: any,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const savedQueue = await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Check if queue with same name already exists in this space
      const existingQueue = await em.findOne(TicketQueue, {
        where: { ticketSpaceId, name },
      });
      if (existingQueue)
        throw new BadRequestException(
          `Queue with name "${name}" already exists in this ticket space`,
        );

      // Create new queue with ticketSpaceId
      const newQueue = new TicketQueue();
      if (authUser?.email) {
        newQueue.createdBy = authUser.email;
      }
      newQueue.ticketSpaceId = ticketSpaceId;
      newQueue.name = name;
      const savedQueue = await em.save(TicketQueue, newQueue);

      // Add to ticket_space_queue join table (many-to-many)
      await em.query(
        `INSERT INTO ticket_space_queue ("ticketSpaceId", "ticketQueueId") VALUES ($1, $2)`,
        [ticketSpaceId, savedQueue.id],
      );
      return savedQueue;
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return savedQueue;
  }

  async removeQueueFromSpace(
    ticketSpaceId: number,
    queueId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    await this.entityManager.transaction(async (em) => {
      const ticketSpace = await em.findOne(TicketSpace, { where });
      if (!ticketSpace)
        throw new NotFoundException(
          `Ticket space with ID ${ticketSpaceId} not found`,
        );

      // Prevent deletion of the Default queue
      const queue = await em.findOne(TicketQueue, {
        where: { id: queueId },
      });
      if (queue?.name === 'Default')
        throw new BadRequestException('The Default queue cannot be deleted');

      // Remove from ticket_space_queue join table
      await em.query(
        `DELETE FROM ticket_space_queue WHERE "ticketSpaceId" = $1 AND "ticketQueueId" = $2`,
        [ticketSpaceId, queueId],
      );
      // Delete the queue
      await em.delete(TicketQueue, { id: queueId });
    });

    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.seedSingleTicketSpaceCache(ticketSpaceId);
    return {
      message: 'Queue removed from ticket space',
      status: 200,
    };
  }

  /** Single DB round-trip for all requested ticket spaces — used by the space list page */
  async getBulkTicketStatusCounts(
    spaceIds: number[],
    activeCompanyId?: number,
  ): Promise<Record<number, any[]>> {
    if (!spaceIds.length) return {};

    interface BulkStatusCountRow {
      ticketSpaceId: number;
      statusId: number;
      count: string;
    }

    const where: any = { ticketSpaceId: In(spaceIds) };
    if (activeCompanyId && activeCompanyId !== 0) {
      // Note: We'd need to join ticket_space to filter by companyId if we really wanted to be strict here
      // but for now, the controller already filters spaceIds based on company context.
    }

    const rows = await this.entityManager
      .createQueryBuilder(Ticket, 'ticket')
      .select('ticket.ticketSpaceId', 'ticketSpaceId')
      .addSelect('ticket.statusId', 'statusId')
      .addSelect('COUNT(ticket.id)', 'count')
      .where('ticket.ticketSpaceId IN (:...spaceIds)', { spaceIds })
      .andWhere('ticket.statusId IS NOT NULL')
      .groupBy('ticket.ticketSpaceId')
      .addGroupBy('ticket.statusId')
      .getRawMany<BulkStatusCountRow>();

    const statusIds = [...new Set(rows.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.entityManager.find(TicketSpaceStatusConfig, { where: { id: In(statusIds) } })
      : [];
    const statusMap = new Map<number, TicketSpaceStatusConfig>(statuses.map((s) => [s.id!, s]));

    const result: Record<number, any[]> = {};
    spaceIds.forEach((id) => (result[id] = []));
    rows.forEach((r) => {
      const status = statusMap.get(r.statusId);
      if (status && parseInt(r.count) > 0) {
        result[r.ticketSpaceId].push({
          statusId: status.id,
          name: status.name,
          color: status.color,
          count: parseInt(r.count),
        });
      }
    });
    return result;
  }
}
