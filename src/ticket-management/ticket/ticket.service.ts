import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Between, EntityManager, Equal, In, LessThan, Not } from 'typeorm';
import { Ticket } from './ticket.entity';
import { Comment } from '../../comment/comment/comment.entity';
import { PostType } from '../../common/enum/post-type.enum';
import { CreateTicketDto, UpdateTicketDto } from './dto/ticket.dto';
import { TicketSpaceMember } from '../ticket-space-member/ticket-space-member.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';
import { TicketSpaceStatusConfig } from '../ticket-space-status-config/ticket-space-status-config.entity';
import { TicketSpaceSeverityConfig } from '../ticket-space-severity-config/ticket-space-severity-config.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';
import { TicketSpaceTypeConfig } from '../ticket-space-type-config/ticket-space-type-config.entity';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { User } from '../../user-management/user/user.entity';
import { TicketAlertService } from '../ticket-alert/ticket-alert.service';
import { TicketEvent } from '../ticket-event/ticket-event.entity';
import { TicketAttachment } from '../ticket-attachment/ticket-attachment.entity';
import { Checklist } from '../../common/checklist/checklist.entity';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { Division } from '../../company-management/division/division.entity';
import { TicketImpact } from '../ticket-impact/ticket-impact.entity';
import { PostSequenceService } from '../../common/sequence/post-sequence.service';
import { PostType as SequencePostType } from '../../common/sequence/post-sequence.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly commonDbOperationService: CommonDbOperationService,
    private readonly ticketAlertService: TicketAlertService,
    private readonly postSequenceService: PostSequenceService,
  ) { }

  async findAll(activeCompanyId?: number) {
    const where: any = {};
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const tickets = await this.entityManager.find(Ticket, {
      where,
      relations: [
        'ticketSpace',
        'status',
        'severity',
        'ticketType',
        'department',
        'queue',
        'impact',
        'ticketSla',
        'assignee',
        'participants',
      ],
      order: { id: 'desc' },
    });

    return Promise.all(
      tickets.map((ticket) => this.transformTicketToDto(ticket)),
    );
  }

  async searchByQueue(
    userId: number,
    param: QueryParam,
    activeCompanyId?: number,
  ): Promise<{ total: number; data: object[] }> {
    const ticketSpaceFilter = param.filters?.find(
      (f) => f.field === 'ticketSpaceId',
    );
    const ticketSpaceId =
      ticketSpaceFilter?.value != null ? Number(ticketSpaceFilter.value) : null;

    if (!ticketSpaceId) {
      return { total: 0, data: [] };
    }

    // Optimize: Single query to directly fetch just the allowed queue IDs instead of full ORM entity hydration
    const userQueueRows = await this.entityManager
      .createQueryBuilder()
      .select('mq.queueId', 'queueId')
      .from('ticket_space_member_queue', 'mq')
      .innerJoin(TicketSpaceMember, 'm', 'm.id = mq.memberId')
      .where('m.ticketSpaceId = :ticketSpaceId', { ticketSpaceId })
      .andWhere('m.userId = :userId', { userId })
      .getRawMany();

    const userQueueIds = userQueueRows.map((r: any) => Number(r.queueId));

    // Security Fix: If the user is not in the space, or has no assigned queues, they cannot see any tickets via this endpoint.
    // (Previously, an empty userQueueIds array would bypass the queue filter and return ALL tickets!)
    if (userQueueIds.length === 0) {
      return { total: 0, data: [] };
    }

    const modifiedFilters = [...(param.filters ?? [])];

    // --- Dynamic Default Status Filter ---
    // If the frontend didn't provide a specific statusId filter, only show active tickets (To Start, Processing)
    const hasStatusFilter = modifiedFilters.some((f) => f.field === 'statusId');
    if (!hasStatusFilter) {
      const defaultStatuses = await this.entityManager.find(TicketSpaceStatusConfig, {
        where: { ticketSpaceId, base: In([StatusBaseEnum.TOSTART, StatusBaseEnum.PROCESSING]) },
        select: ['id'],
      });
      if (defaultStatuses.length > 0) {
        modifiedFilters.push({
          field: 'statusId',
          matchMode: 'in',
          value: defaultStatuses.map((s) => s.id),
        });
      }
    }

    if (userQueueIds.length > 0) {
      const existingQueueFilterIndex = modifiedFilters.findIndex(
        (f) => f.field === 'queueId',
      );

      if (existingQueueFilterIndex >= 0) {
        const existingFilter = modifiedFilters[existingQueueFilterIndex];
        const appliedQueueIds: number[] = Array.isArray(existingFilter.value)
          ? existingFilter.value.map(Number)
          : [Number(existingFilter.value)];

        const intersected = appliedQueueIds.filter((id) =>
          userQueueIds.includes(id),
        );

        if (intersected.length === 0) {
          return { total: 0, data: [] };
        }

        modifiedFilters[existingQueueFilterIndex] = {
          ...existingFilter,
          value: intersected,
          matchMode: 'in',
        };
      } else {
        modifiedFilters.push({
          field: 'queueId',
          value: userQueueIds,
          matchMode: 'in',
        });
      }
    }

    if (activeCompanyId && activeCompanyId !== 0) {
      modifiedFilters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    return this.commonDbOperationService.search('ticket', {
      ...param,
      filters: modifiedFilters,
    });
  }

  async findOne(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticket = await this.entityManager.findOne(Ticket, {
      where,
      relations: [
        'ticketSpace',
        'status',
        'severity',
        'ticketType',
        'department',
        'queue',
        'impact',
        'ticketSla',
        'assignee',
        'participants',
      ],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.transformTicketToDto(ticket);
  }

  async findBase(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticket = await this.entityManager.findOne(Ticket, {
      where,
      relations: ['ticketSpace'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.transformTicketToDto(ticket);
  }

  async findAssignees(
    id: number,
    activeCompanyId?: number,
  ): Promise<{
    assignee: any;
    participants: any[];
  }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticket = await this.entityManager.findOne(Ticket, {
      where,
      relations: ['assignee', 'participants'],
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    const mapPermission = (p: TicketSpaceMember | null) => {
      if (!p) return null;
      return {
        id: p.id,
        userId: p.userId,
        userFirstName: p.userFirstName ?? null,
        userLastName: p.userLastName ?? null,
        userEmail: p.userEmail ?? null,
        profile_picture: p.userProfilePicture ?? null,
      };
    };
    return {
      assignee: ticket.assignee ? mapPermission(ticket.assignee) : null,
      participants: (ticket.participants ?? [])
        .map((p) => mapPermission(p))
        .filter(Boolean),
    };
  }

  async findEvents(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ ticketEvents: any[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticket = await this.entityManager.findOne(Ticket, {
      where,
      select: ['id'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const events = await this.entityManager.find(TicketEvent, {
      where: { ticketId: id },
      order: { occurredAt: 'DESC' },
    });

    return { ticketEvents: events };
  }

  async getNextTicketCodeById(
    ticketSpaceId: number,
    activeCompanyId?: number,
  ): Promise<{ code: string }> {
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

    return this.getNextTicketCode(ticketSpace);
  }

  async getNextTicketCode(ticketSpace: TicketSpace): Promise<{ code: string }> {
    const generated = await this.postSequenceService.generateAndAssignCode(
      this.entityManager,
      ticketSpace.companyId,
      ticketSpace.id!,
      SequencePostType.TKT,
    );
    return { code: `${ticketSpace.prefix}-${generated}` };
  }

  async create(
    createTicketDto: CreateTicketDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const savedTicket = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const newTicket = new Ticket();
        const {
          participantIds,
          participants,
          code: providedCode,
          ...ticketData
        } = createTicketDto;
        Object.assign(newTicket, ticketData);

        const where: any = { id: createTicketDto.ticketSpaceId };
        if (activeCompanyId && activeCompanyId !== 0) {
          where.companyId = activeCompanyId;
          newTicket.companyId = activeCompanyId;
        }

        // 1. Extract values from your incoming DTO (assuming 'dto' is your input)
        let divisionId = createTicketDto.ticketSpaceDivisionId;
        let ticketSpaceName = createTicketDto.ticketSpaceName;
        let ticketSpacePrefix = createTicketDto.ticketSpacePrefix;
        let companyId = newTicket.companyId;

        // 2. Fallback: If any field is missing, fetch them from the database using the ID
        if (
          createTicketDto.ticketSpaceId &&
          (!divisionId || !ticketSpaceName || !ticketSpacePrefix || !companyId)
        ) {
          const ticketSpace = await transactionalEntityManager.findOne(
            TicketSpace,
            {
              where: { id: createTicketDto.ticketSpaceId }, // Or use your custom 'where' object
              select: ['id', 'prefix', 'name', 'divisionId', 'companyId'],
            },
          );

          console.log('ticketSpace', ticketSpace);

          if (ticketSpace) {
            divisionId = ticketSpace.divisionId;
            ticketSpaceName = ticketSpace.name;
            ticketSpacePrefix = ticketSpace.prefix;
            if (ticketSpace.companyId) {
               companyId = ticketSpace.companyId;
            }
          }
        }

        if (
          divisionId === undefined ||
          !ticketSpaceName ||
          !ticketSpacePrefix
        ) {
          throw new BadRequestException(
            `Valid ticket space information could not be resolved for ID: ${createTicketDto.ticketSpaceId}`,
          );
        }

        // 3. Assign the resolved values to your new ticket entity
        if (createTicketDto.ticketSpaceId) {
          newTicket.ticketSpaceId = createTicketDto.ticketSpaceId;
          newTicket.divisionId = divisionId;
          newTicket.ticketSpaceName = ticketSpaceName;
          newTicket.ticketSpacePrefix = ticketSpacePrefix;

          // Handle ticket auto-generation code logic
          if (providedCode) {
            newTicket.code = providedCode;
          } else {
            const ticketSpaceContext = {
              id: createTicketDto.ticketSpaceId,
              prefix: ticketSpacePrefix,
              name: ticketSpaceName,
              divisionId: divisionId,
              companyId: companyId,
            };

            const { code } = await this.getNextTicketCode(
              ticketSpaceContext as any,
            );
            newTicket.code = code;
          }
        }

        await this.updateDenormalizedFields(newTicket, createTicketDto);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        newTicket.createdBy = authUser.email;

        // Handle participants: prefer full objects over IDs for better performance
        let participantList: TicketSpaceMember[] = [];
        if (
          participants &&
          Array.isArray(participants) &&
          participants.length > 0
        ) {
          participantList = participants as TicketSpaceMember[];
        } else if (
          participantIds &&
          Array.isArray(participantIds) &&
          participantIds.length > 0
        ) {
          // Only IDs provided - fetch the participant objects
          participantList = await transactionalEntityManager.find(
            TicketSpaceMember,
            {
              where: { id: In(participantIds) },
            },
          );

          console.log('participantList', participantList);
        }

        if (participantList.length > 0) {
          newTicket.participants = participantList;
        }

        const effectiveAssigneeId = newTicket.assigneeId ?? createTicketDto.assigneeId;

        // Auto-add creator as participant (unless creator is the assignee)
        if (createTicketDto.ticketSpaceId) {
          const creatorPermission = await transactionalEntityManager.findOne(TicketSpaceMember, {
            where: { userEmail: authUser.email, ticketSpaceId: createTicketDto.ticketSpaceId }
          });
          if (creatorPermission && creatorPermission.id !== effectiveAssigneeId) {
            if (!newTicket.participants) newTicket.participants = [];
            if (!newTicket.participants.some(p => p.id === creatorPermission.id)) {
              newTicket.participants.push(creatorPermission);
            }
          }
        }

        // Ensure the assignee is never in the participants list
        if (effectiveAssigneeId && newTicket.participants) {
          newTicket.participants = newTicket.participants.filter(
            (p) => p.id !== effectiveAssigneeId,
          );
        }

        // Compute SLA deadlines inline (avoid extra DB round-trip after save)
        if (newTicket.slaResponseTime || newTicket.slaResolutionTime) {
          const createdAt = new Date();
          const baseMs = createdAt.getTime();
          if (newTicket.slaResponseTime && newTicket.slaResponseTime > 0) {
            newTicket.slaResponseDeadline = new Date(baseMs + newTicket.slaResponseTime * 60 * 1000);
          }
          if (newTicket.slaResolutionTime && newTicket.slaResolutionTime > 0) {
            newTicket.slaResolutionDeadline = new Date(baseMs + newTicket.slaResolutionTime * 60 * 1000);
          }
        }

        const savedTicket = await transactionalEntityManager.save(
          Ticket,
          newTicket,
        );

        return savedTicket;
      },
    );

    // Alert happens after transaction commit (non-blocking)
    void this.ticketAlertService.dispatchTicketCreated(
      savedTicket.id!,
      authUser,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return savedTicket;
  }

  async patchTicket(
    id: number,
    updateTicketDto: UpdateTicketDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Ticket> {
    // Capture snapshot before transaction for change tracking
    const oldSnapshot: Record<string, unknown> = {};
    for (const key of Object.keys(updateTicketDto)) {
      if (key !== 'participantIds' && key !== 'participants') {
        // These will be populated within the transaction
        oldSnapshot[key] = undefined;
      }
    }

    const result = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const { participantIds, participants, ...ticketData } = updateTicketDto;

        // Only load participants relation when we actually need to change it.
        // Loading it unconditionally causes TypeORM's save() to re-INSERT all
        // existing join-table rows, triggering a duplicate-key violation.
        const where: any = { id };
        if (activeCompanyId && activeCompanyId !== 0) {
          where.companyId = activeCompanyId;
        }

        const shouldLoadParticipants =
          participants !== undefined || participantIds !== undefined;
        const existingTicket = await transactionalEntityManager.findOne(
          Ticket,
          {
            where,
            relations: shouldLoadParticipants ? ['participants'] : [],
          },
        );

        if (!existingTicket) {
          throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        const snap = existingTicket as unknown as Record<string, unknown>;
        for (const key of Object.keys(ticketData)) {
          oldSnapshot[key] = snap[key];
        }
        if (participants !== undefined || participantIds !== undefined) {
          oldSnapshot['participantIds'] =
            existingTicket.participants?.map((p) => p.id) ?? [];
        }

        // Handle participants: prefer full objects over IDs for better performance
        if (participants !== undefined || participantIds !== undefined) {
          let participantList: TicketSpaceMember[] = [];

          if (
            participants &&
            Array.isArray(participants) &&
            participants.length > 0
          ) {
            // Full objects provided - use them directly
            participantList = participants as TicketSpaceMember[];
          } else if (
            Array.isArray(participantIds) &&
            participantIds.length > 0
          ) {
            // Only IDs provided - fetch the participant objects
            participantList = await transactionalEntityManager.find(
              TicketSpaceMember,
              {
                where: { id: In(participantIds) },
              },
            );
          }

          // Clear existing join-table rows first to avoid duplicate-key violations.
          await transactionalEntityManager.query(
            `DELETE FROM ticket_participants WHERE "ticketId" = $1`,
            [id],
          );
          existingTicket.participants = participantList;
        }

        transactionalEntityManager.merge(Ticket, existingTicket, ticketData);
        await this.updateDenormalizedFields(existingTicket, updateTicketDto);

        const effectiveAssigneeId = existingTicket.assigneeId ?? updateTicketDto.assigneeId;
        if (effectiveAssigneeId && existingTicket.participants) {
          existingTicket.participants = existingTicket.participants.filter(
            (p) => p.id !== effectiveAssigneeId,
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        existingTicket.updatedBy = authUser.email;

        await transactionalEntityManager.save(existingTicket);

        // If ticketSlaId, severityId, or statusId changed via general patch, refresh SLA deadlines
        if (
          ticketData.ticketSlaId !== undefined ||
          ticketData.severityId !== undefined ||
          ticketData.statusId !== undefined
        ) {
          const refreshed = await transactionalEntityManager.findOne(Ticket, {
            where: { id },
            relations: ['status'],
            select: ['id'],
          });
          void this.refreshSlaDeadlines(
            id,
            null,
            refreshed?.status?.base ?? null,
          );
        }

        return existingTicket;
      },
    );

    // Alert dispatch after transaction commit (non-blocking)
    await this.ticketAlertService.dispatchTicketUpdated(
      id,
      updateTicketDto as unknown as Record<string, unknown>,
      oldSnapshot,
      authUser,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.findOne(id, activeCompanyId);
  }

  async patchTicketName(
    id: number,
    name: string,
    oldName: string | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ id: number; name: string; updatedAt: Date; updatedBy: string }> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.update(Ticket, where, {
        name,
        updatedBy: authUser.email as string,
        updatedAt: now,
      });
      if (!result.affected)
        throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    });

    // Fire-and-forget alert (oldName supplied by caller — no extra DB read needed)
    void this.ticketAlertService.dispatchNameChanged(
      id,
      oldName ?? name,
      authUser,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return { id, name, updatedAt: now, updatedBy: authUser.email as string };
  }

  async patchTicketStatus(
    id: number,
    statusId: number,
    oldStatusId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<any> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const resolvedStatus = await this.entityManager.findOne(TicketSpaceStatusConfig, {
      where: { id: statusId },
    });

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.update(Ticket, where, {
        statusId: statusId as any,
        statusName: resolvedStatus?.name,
        statusColor: resolvedStatus?.color,
        statusBase: resolvedStatus?.base ?? '',
        updatedBy: authUser.email as string,
        updatedAt: now,
      });
      if (!result.affected)
        throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    });

    // Fire-and-forget alert (oldStatusId supplied by caller — no extra DB read)
    void this.ticketAlertService.dispatchStatusChanged(
      id,
      oldStatusId,
      authUser,
    );

    // Freeze SLA deadlines when Finished; restore when moving away from Finished.
    if (
      resolvedStatus?.base === StatusBaseEnum.FINISHED ||
      resolvedStatus?.base === StatusBaseEnum.PROCESSING ||
      resolvedStatus?.base === StatusBaseEnum.TOSTART
    ) {
      const ticketForSla = await this.entityManager.findOne(Ticket, {
        where: { id },
        select: ['id'],
      });
      if (ticketForSla) {
        void this.refreshSlaDeadlines(
          id,
          null,
          resolvedStatus.base,
        );
      }
    }

    return { id, statusId, status: resolvedStatus };
  }

  async patchTicketSeverity(
    id: number,
    severityId: number,
    oldSeverityId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<any> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    // 1. Resolve the metadata for the new Severity level safely
    const resolvedSeverity = severityId
      ? await this.entityManager.findOne(TicketSpaceSeverityConfig, {
        where: { id: severityId },
      })
      : null;

    // 2. Perform updates inside the transaction and directly assign the returned Ticket entity
    const updatedTicket = await this.entityManager.transaction<Ticket>(
      async (transactionalEntityManager) => {
        const existingTicket = await transactionalEntityManager.findOne(
          Ticket,
          {
            where,
          },
        );

        if (!existingTicket) {
          throw new NotFoundException(`Ticket with ID ${id} not found.`);
        }

        // Safe assignments
        existingTicket.severityId = severityId;
        existingTicket.severityName = resolvedSeverity?.name as string;
        existingTicket.severityColor = resolvedSeverity?.color as string;

        // 3. Look up the new SLA matrix matching this severity scale
        // NOTE: Stored directly in TicketSpaceSeverityConfig
        if (resolvedSeverity) {
          existingTicket.slaResponseTime = resolvedSeverity.responseTimeInMinutes ?? 0;
          existingTicket.slaResolutionTime = resolvedSeverity.resolutionTimeInMinutes ?? 0;
        } else {
          existingTicket.slaResponseTime = 0;
          existingTicket.slaResolutionTime = 0;
        }

        // 4. Recalculate pre-computed deadlines
        const deadlines = await this.computeSlaDeadlines(
          existingTicket.id as number,
          null,
          existingTicket.statusBase,
          existingTicket.createdAt,
          existingTicket.slaResponseTime,
          existingTicket.slaResolutionTime,
        );

        existingTicket.slaResponseDeadline = deadlines.slaResponseDeadline;
        existingTicket.slaResolutionDeadline = deadlines.slaResolutionDeadline;

        existingTicket.updatedBy = authUser.email as string;
        existingTicket.updatedAt = now;

        // ✨ RETURN the saved ticket out of the transaction callback scope
        return await transactionalEntityManager.save(Ticket, existingTicket);
      },
    );

    // Fire-and-forget alert payload
    void this.ticketAlertService.dispatchTicketUpdated(
      id,
      { severityId } as any,
      { severityId: oldSeverityId },
      authUser,
    );

    // 5. Return the fields back to your frontend. TypeScript now knows updatedTicket is a valid Ticket!
    return {
      id,
      severityId,
      severity: resolvedSeverity,
      slaResponseTime: updatedTicket.slaResponseTime,
      slaResolutionTime: updatedTicket.slaResolutionTime,
      slaResponseDeadline: updatedTicket.slaResponseDeadline,
      slaResolutionDeadline: updatedTicket.slaResolutionDeadline,
    };
  }

  async patchTicketQueue(
    id: number,
    queueId: number | null,
    oldQueueId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<any> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const resolvedQueue = queueId
      ? await this.entityManager.findOne(TicketQueue, {
        where: { id: queueId },
      })
      : null;

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.update(Ticket, where, {
        queueId: queueId as any,
        queueName: resolvedQueue?.name,
        updatedBy: authUser.email as string,
        updatedAt: now,
      });
      if (!result.affected)
        throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    });

    // Fire-and-forget alert (oldQueueId supplied by caller — no extra DB read)
    void this.ticketAlertService.dispatchQueueChanged(id, oldQueueId, authUser);

    return { id, queueId, queue: resolvedQueue };
  }

  async patchTicketImpact(
    id: number,
    impactId: number | null,
    oldImpactId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<any> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const resolvedImpact = impactId
      ? await this.entityManager.findOne(TicketImpact, {
        where: { id: impactId },
      })
      : null;

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.update(Ticket, where, {
        impactId: impactId as any,
        impactName: resolvedImpact?.name,
        updatedBy: authUser.email as string,
        updatedAt: now,
      });
      if (!result.affected)
        throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    });

    // You can add impact change alert dispatch here if such an alert exists in your service
    // void this.ticketAlertService.dispatchImpactChanged(id, oldImpactId, authUser);

    return { id, impactId, impact: resolvedImpact };
  }

  async patchTicketType(
    id: number,
    ticketTypeId: number,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<any> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const resolvedTicketType = await this.entityManager.findOne(TicketSpaceTypeConfig, {
      where: { id: ticketTypeId },
    });

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.update(Ticket, where, {
        ticketTypeId: ticketTypeId as any,
        ticketTypeName: resolvedTicketType?.name,
        ticketTypeIcon: resolvedTicketType?.icon,
        updatedBy: authUser.email as string,
        updatedAt: now,
      });
      if (!result.affected)
        throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    });

    return { id, ticketTypeId, ticketType: resolvedTicketType };
  }

  async patchTicketAssignee(
    id: number,
    assigneeId: number | null,
    oldAssigneeId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<any> {
    const now = new Date();

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    let assignee: Record<string, any> | null = null;
    if (assigneeId) {
      const permission = await this.entityManager.findOne(TicketSpaceMember, {
        where: { id: assigneeId },
      });
      if (permission) {
        assignee = {
          id: permission.userId,
          first_name: permission.userFirstName,
          last_name: permission.userLastName,
          email: permission.userEmail,
          profile_picture: permission.userProfilePicture,
        };
      }
    }

    let updatedParticipants: any[] = [];
    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const ticket = await transactionalEntityManager.findOne(Ticket, {
        where,
        relations: ['participants'],
      });

      if (!ticket) {
        throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
      }

      // Handle adding/removing participants
      let newParticipants = [...ticket.participants];

      // Add old assignee to participants if not already present
      if (oldAssigneeId) {
        if (!newParticipants.some(p => p.id === oldAssigneeId)) {
          const oldPermission = await transactionalEntityManager.findOne(TicketSpaceMember, {
            where: { id: oldAssigneeId }
          });
          if (oldPermission) {
            newParticipants.push(oldPermission);
          }
        }
      }

      // Remove new assignee from participants if present
      if (assigneeId) {
        newParticipants = newParticipants.filter(p => p.id !== assigneeId);
      }
      
      ticket.participants = newParticipants;

      ticket.assigneeId = assigneeId as any;
      ticket.assigneeName = assignee
        ? `${assignee.first_name} ${assignee.last_name}`
        : '';
      ticket.assigneeProfilePicUrl = assignee ? (assignee.profile_picture ?? '') : '';
      ticket.assigneeEmail = assignee ? (assignee.email ?? '') : '';
      ticket.updatedBy = authUser.email as string;
      ticket.updatedAt = now;

      await transactionalEntityManager.save(Ticket, ticket);
      updatedParticipants = ticket.participants;
    });

    // Fire-and-forget alert (oldAssigneeId supplied by caller — no extra DB read)
    void this.ticketAlertService.dispatchTicketAssigned(
      id,
      oldAssigneeId,
      authUser,
    );

    return { id, assigneeId, assignee, participants: updatedParticipants };
  }

  async patchTicketParticipants(
    id: number,
    participantIds: number[],
    authUser: any,
    activeCompanyId?: number,
    participants?: any[],
  ): Promise<any> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const where: any = { id };
        if (activeCompanyId && activeCompanyId !== 0) {
          where.companyId = activeCompanyId;
        }

        const existingTicket = await transactionalEntityManager.findOne(
          Ticket,
          {
            where,
            relations: ['participants'],
          },
        );

        if (!existingTicket) {
          throw new NotFoundException(`Ticket with ID ${id} not found.`);
        }

        let permissions: TicketSpaceMember[] = [];

        // Prefer full participant objects over IDs for better performance
        if (
          participants &&
          Array.isArray(participants) &&
          participants.length > 0
        ) {
          // Full objects provided - use them directly
          permissions = participants as TicketSpaceMember[];
        } else if (Array.isArray(participantIds) && participantIds.length > 0) {
          // Only IDs provided - fetch the participant objects
          permissions = await transactionalEntityManager.find(
            TicketSpaceMember,
            {
              where: { id: In(participantIds) },
            },
          );
        }

        // Clear existing join-table rows first to avoid duplicate-key violations,
        // then let TypeORM re-insert the new set.
        await transactionalEntityManager.query(
          `DELETE FROM ticket_participants WHERE "ticketId" = $1`,
          [id],
        );

        if (existingTicket.assigneeId) {
          permissions = permissions.filter(
            (p) => p.id !== existingTicket.assigneeId,
          );
        }
        existingTicket.participants = permissions;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        existingTicket.updatedBy = authUser.email;

        await transactionalEntityManager.save(existingTicket);

        const participantResponse = permissions.map((permission) => ({
          id: permission.id,
          userId: permission.userId,
          userFirstName: permission.userFirstName,
          userLastName: permission.userLastName,
          userEmail: permission.userEmail,
          userProfilePicture: permission.userProfilePicture,
        }));

        return { id, participants: participantResponse };
      },
    );
  }

  async patchTicketDescription(
    id: number,
    description: string | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ id: number; description: string | null }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const ticket = await transactionalEntityManager.findOne(Ticket, {
          where,
        });
        if (!ticket)
          throw new NotFoundException(`Ticket with ID ${id} not found.`);
        ticket.description = description as string;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ticket.updatedBy = authUser.email;
        await transactionalEntityManager.save(ticket);
        return { id, description };
      },
    );
  }

  async patchTicketEffort(
    id: number,
    plannedEffort: number | null,
    actualEffort: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    plannedEffort: number | null;
    actualEffort: number | null;
  }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const ticket = await transactionalEntityManager.findOne(Ticket, {
          where,
        });
        if (!ticket)
          throw new NotFoundException(`Ticket with ID ${id} not found.`);
        if (plannedEffort !== null)
          (ticket as any).plannedEffort = plannedEffort;
        if (actualEffort !== null) (ticket as any).actualEffort = actualEffort;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ticket.updatedBy = authUser.email;
        await transactionalEntityManager.save(ticket);
        return {
          id,
          plannedEffort: (ticket as any).plannedEffort ?? null,
          actualEffort: (ticket as any).actualEffort ?? null,
        };
      },
    );
  }

  async patchTicketCompletionDate(
    id: number,
    completionDate: string | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ id: number; completionDate: string | null }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const ticket = await transactionalEntityManager.findOne(Ticket, {
          where,
        });
        if (!ticket)
          throw new NotFoundException(`Ticket with ID ${id} not found.`);
        (ticket as any).completionDate = completionDate
          ? new Date(completionDate)
          : null;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ticket.updatedBy = authUser.email;
        await transactionalEntityManager.save(ticket);
        const saved = (ticket as any).completionDate as Date | null;
        return {
          id,
          completionDate: saved ? saved.toISOString().split('T')[0] : null,
        };
      },
    );
  }

  async delete(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const ticket = await this.entityManager.findOne(Ticket, {
      where,
      relations: [
        'ticketSpace',
        'status',
        'severity',
        'assignee',
        'participants',
      ],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found.`);
    }

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.query(
        `DELETE FROM ticket_participants WHERE "ticketId" = $1`,
        [id],
      );
      await transactionalEntityManager.delete(TicketEvent, { ticketId: id });
      await transactionalEntityManager.delete(TicketAttachment, {
        ticketId: id,
      });

      // Checklists live in the shared polymorphic table, so there is no FK
      // cascade to rely on — remove them explicitly.
      await transactionalEntityManager.delete(Checklist, {
        entityType: 'Ticket',
        entityId: id,
      });

      const deleteResult = await transactionalEntityManager.delete(
        Ticket,
        where,
      );
      if (!deleteResult.affected || deleteResult.affected === 0) {
        throw new NotFoundException(`Ticket with ID ${id} not found.`);
      }

      await this.postSequenceService.reduceSequenceIfMaximum(
        transactionalEntityManager,
        ticket.companyId,
        ticket.ticketSpaceId,
        SequencePostType.TKT,
        null,
        ticket.code,
      );
    });

    // Alert dispatch after transaction commit (non-blocking)
    await this.ticketAlertService.dispatchTicketDeleted(id, authUser, ticket);
    await this.ticketAlertService.cleanupTicketAlerts(id);

    return {
      message: 'Ticket deleted',
      status: 200,
    };
  }

  async getBulkTicketRelations(
    ticketIds: number[],
    activeCompanyId?: number,
  ): Promise<any> {
    if (!ticketIds || ticketIds.length === 0) {
      return {};
    }

    // Security: Filter IDs by companyId first
    const companyFilter: any = { id: In(ticketIds) };
    if (activeCompanyId && activeCompanyId !== 0) {
      companyFilter.companyId = activeCompanyId;
    }
    const filteredTickets = await this.entityManager.find(Ticket, {
      where: companyFilter,
      select: ['id'],
    });
    const validIds = filteredTickets.map((t) => t.id);
    if (validIds.length === 0) return {};
    const effectiveIds = validIds as number[];

    // Fetch participants via relations
    const ticketsWithParticipants = await this.entityManager.find(Ticket, {
      where: { id: In(effectiveIds) },
      relations: ['participants'],
      select: ['id'], // Only need the IDs and the joined participants
    });

    const participantsMap: Record<number, any[]> = {};
    ticketsWithParticipants.forEach((t) => {
      if (t.id !== undefined) {
        participantsMap[t.id] = t.participants || [];
      }
    });

    // Enriches with comment counts (requires aggregation).
    const commentCounts = await this.entityManager
      .createQueryBuilder(Comment, 'comment')
      .select('comment.postId', 'postId')
      .addSelect('COUNT(comment.id)', 'count')
      .where('comment.postType = :postType', { postType: PostType.TKT })
      .andWhere('comment.postId IN (:...effectiveIds)', { effectiveIds })
      .andWhere('comment.parentId IS NULL')
      .groupBy('comment.postId')
      .getRawMany();

    const commentCountMap: Record<number, number> = {};
    commentCounts.forEach((row: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      commentCountMap[Number(row.postId)] = parseInt(row.count as string, 10);
    });

    const result: Record<number, any> = {};
    effectiveIds.forEach((id) => {
      result[id] = { 
        commentCount: commentCountMap[id] ?? 0,
        participants: participantsMap[id] ?? [],
      };
    });

    return result;
  }

  async getTicketStatusCounts(
    ticketSpaceId: number,
    activeCompanyId?: number,
  ): Promise<any[]> {
    if (!ticketSpaceId) {
      return [];
    }

    const where: any = { ticketSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    interface StatusCountRow {
      statusId: number;
      count: string;
    }

    const statusCounts = await this.entityManager
      .createQueryBuilder(Ticket, 'ticket')
      .select('ticket.statusId', 'statusId')
      .addSelect('COUNT(ticket.id)', 'count')
      .where(where)
      .andWhere('ticket.statusId IS NOT NULL')
      .groupBy('ticket.statusId')
      .getRawMany<StatusCountRow>();

    const statusIds = statusCounts
      .filter((sc) => parseInt(sc.count) > 0)
      .map((sc) => sc.statusId);

    if (statusIds.length === 0) {
      return [];
    }

    const statuses = await this.entityManager.find(TicketSpaceStatusConfig, {
      where: { id: In(statusIds) },
    });

    return statusCounts
      .filter((sc) => parseInt(sc.count) > 0)
      .map((sc) => {
        const status = statuses.find((s) => s.id === sc.statusId);
        return status
          ? {
            statusId: status.id,
            name: status.name,
            color: status.color,
            count: parseInt(sc.count),
          }
          : null;
      })
      .filter((item) => item !== null);
  }

  /** Single DB round-trip for all requested ticket spaces — used by the space list page */
  async getBulkTicketStatusCounts(
    spaceIds: number[],
    activeCompanyId?: number,
  ): Promise<Record<number, any[]>> {
    if (!spaceIds.length) return {};

    const where: any = { ticketSpaceId: In(spaceIds) };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    interface BulkStatusCountRow {
      ticketSpaceId: number;
      statusId: number;
      count: string;
    }

    const rows = await this.entityManager
      .createQueryBuilder(Ticket, 'ticket')
      .select('ticket.ticketSpaceId', 'ticketSpaceId')
      .addSelect('ticket.statusId', 'statusId')
      .addSelect('COUNT(ticket.id)', 'count')
      .where(where)
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

  async searchWithStatus(
    param: QueryParam,
    activeCompanyId?: number,
  ): Promise<{ total: number; data: object[] }> {
    let total = 0;
    let data: Ticket[] = [];

    const { first, rows, multiSorts, filters } = param;
    const modifiedFilters = filters ? [...filters] : [];

    if (activeCompanyId && activeCompanyId !== 0) {
      modifiedFilters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    let query = this.entityManager
      .getRepository(Ticket)
      .createQueryBuilder('entity')
      .leftJoinAndSelect('entity.status', 'status');

    // Load optional extra relations (same pattern as commonDbOperationService.search)
    param.withRelations?.forEach((rel) => {
      query = query.leftJoinAndSelect(`entity.${rel}`, rel);
    });

    modifiedFilters?.forEach((fl) => {
      // These matchModes don't require a value – handle them first
      if (fl.matchMode === 'is-null') {
        query = query.andWhere(
          `${fl.field.includes('') ? fl.field : `entity.${fl.field}`} IS NULL`,
        );
        return;
      }
      if (fl.matchMode === 'not-null') {
        query = query.andWhere(
          `${fl.field.includes('') ? fl.field : `entity.${fl.field}`} IS NOT NULL`,
        );
        return;
      }

      if (fl?.value !== undefined && fl?.value !== null && fl?.value !== '') {
        const paramKey = `${fl.field.replace('.', '_')}_${Math.random()
          .toString(36)
          .substring(2, 8)}`;
        const fieldName = fl.field.includes('.')
          ? fl.field
          : `entity.${fl.field}`;

        if (fl.matchMode === 'startsWith') {
          query = query.andWhere(`${fieldName} ILIKE :${paramKey}`, {
            [paramKey]: `${fl.value}%`,
          });
        } else if (fl.matchMode === 'endsWith') {
          query = query.andWhere(`${fieldName} ILIKE :${paramKey}`, {
            [paramKey]: `%${fl.value}`,
          });
        } else if (fl.matchMode === 'contains') {
          query = query.andWhere(`${fieldName} ILIKE :${paramKey}`, {
            [paramKey]: `%${fl.value}%`,
          });
        } else if (fl.matchMode === 'notContains') {
          query = query.andWhere(`${fieldName} NOT ILIKE :${paramKey}`, {
            [paramKey]: `%${fl.value}%`,
          });
        } else if (fl.matchMode === 'equals') {
          query = query.andWhere(`${fieldName} = :${paramKey}`, {
            [paramKey]: fl.value.toString().trim(),
          });
        } else if (fl.matchMode === 'notEquals') {
          query = query.andWhere(`${fieldName} <> :${paramKey}`, {
            [paramKey]: fl.value.toString().trim(),
          });
        } else if (fl.matchMode === 'in' || fl.matchMode === 'list') {
          if (
            fl.field === 'slaResolutionDeadline' ||
            fl.field === 'createdAt'
          ) {
            query = query.andWhere(`DATE(${fieldName}) IN (:...${paramKey})`, {
              [paramKey]: fl.value,
            });
          } else {
            query = query.andWhere(`${fieldName} IN (:...${paramKey})`, {
              [paramKey]: fl.value,
            });
          }
        } else if (
          fl.matchMode &&
          ['>', '<', '>=', '<='].includes(fl.matchMode)
        ) {
          query = query.andWhere(`${fieldName} ${fl.matchMode} :${paramKey}`, {
            [paramKey]: fl.value.toString(),
          });
        } else if (fl.matchMode === 'dateIs') {
          const date1 = new Date(fl.value as string)
            .toISOString()
            .split('T')[0];
          query = query.andWhere(`DATE(${fieldName}) = :${paramKey}`, {
            [paramKey]: date1,
          });
        } else if (fl.matchMode === 'dateBetween') {
          const [fromVal, toVal] = fl.value as [string, string];
          const fromDate = new Date(fromVal).toISOString().split('T')[0];
          const toDate = new Date(toVal).toISOString().split('T')[0];
          query = query.andWhere(
            `DATE(${fieldName}) BETWEEN :${paramKey}_from AND :${paramKey}_to`,
            { [`${paramKey}_from`]: fromDate, [`${paramKey}_to`]: toDate },
          );
        } else if (fl.matchMode === 'relation-in') {
          const relValue = fl.value as {
            joinTable: string;
            ownerColumn: string;
            filterColumn: string;
            ids: number[];
          };
          if (
            relValue &&
            Array.isArray(relValue.ids) &&
            relValue.ids.length > 0
          ) {
            const sanitise = (s: string) => s.replace(/[^\w.]/g, '');
            const joinTable = sanitise(relValue.joinTable);
            const ownerColumn = sanitise(relValue.ownerColumn);
            const filterColumn = sanitise(relValue.filterColumn);
            query = query.andWhere(
              `entity.id IN (SELECT "${ownerColumn}" FROM "${joinTable}" WHERE "${filterColumn}" IN (:...${paramKey}))`,
              { [paramKey]: relValue.ids },
            );
          }
        }
      }
    });

    total = await query.getCount();

    if (multiSorts) {
      multiSorts.forEach((ms) => {
        const fieldName = ms.field.includes('.')
          ? ms.field
          : `entity.${ms.field}`;
        query = query.addOrderBy(
          fieldName,
          ms.order === 'DESC' || ms.order === '-1' || +ms.order === -1
            ? 'DESC'
            : 'ASC',
        );
      });
    }

    query = query.offset(first ? +first : 0).limit(rows ? +rows : 1000);
    data = await query.getMany();

    return { total, data };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOME DASHBOARD HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve all ticket_space_member.id values for this user.
   * A user has one permission row per ticket space they belong to.
   */
  async getPermissionIdsByUserId(userId: number): Promise<number[]> {
    const permissions = await this.entityManager.find(TicketSpaceMember, {
      where: { userId },
      select: ['id'],
    });
    return permissions.map((p) => p.id!).filter(Boolean);
  }

  /**
   * Top-5 tickets assigned to the currently authenticated user.
   * Sorted by slaResolutionDeadline ASC (soonest breach first).
   * Tickets with no SLA deadline fall to the end (NULLS LAST — PostgreSQL default for ASC).
   * Excludes tickets whose status.base = 'Finished'.
   */
  async findMyTickets(
    userId: number,
    activeCompanyId?: number,
    dates?: string,
    rows = 100,
    page = 0,
    windowFrom?: string,
    fromDate?: string,
    toDate?: string,
    tab?: any,
  ): Promise<{
    total: number;
    overdueCount: number;
    dueTodayCount: number;
    statusCounts: Record<string, number>;
    data: any[];
  }> {
    const permIds = await this.getPermissionIdsByUserId(userId);
    if (!permIds.length) {
      return {
        total: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        statusCounts: {},
        data: [],
      };
    }

    const today = (windowFrom ?? new Date().toISOString()).split('T')[0];

    const baseWhere: any = {
      companyId: activeCompanyId,
      assigneeId: In(permIds),
      statusBase: Not(StatusBaseEnum.FINISHED),
    };

    if (dates && dates.length > 0) {
      const dateStr = dates.split(',')[0];
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      baseWhere.slaResolutionDeadline = Between(startOfDay, endOfDay);
    } else if (fromDate && toDate) {
      const fromDateObj = new Date(fromDate);
      fromDateObj.setHours(0, 0, 0, 0);
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      baseWhere.slaResolutionDeadline = Between(fromDateObj, toDateObj);
    }

    const countWhere: any = { ...baseWhere };

    if (tab) {
      if (tab === 'overdue') {
        baseWhere.slaResolutionDeadline = LessThan(today);
      } else if (tab === 'today') {
        baseWhere.slaResolutionDeadline = Equal(today);
      } else if (tab !== 'all') {
        baseWhere.statusName = tab;
      }
    }

    const [total, overdueCount, dueTodayCount, statusCountsResult, data] =
      await Promise.all([
        this.entityManager.count(Ticket, { where: baseWhere }),
        this.entityManager.count(Ticket, {
          where: { ...countWhere, slaResolutionDeadline: LessThan(today) },
        }),
        this.entityManager.count(Ticket, {
          where: { ...countWhere, slaResolutionDeadline: Equal(today) },
        }),
        this.entityManager
          .createQueryBuilder(Ticket, 'ticket')
          .select('ticket.statusName', 'statusName')
          .addSelect('COUNT(ticket.id)', 'count')
          .where(countWhere)
          .groupBy('ticket.statusName')
          .getRawMany(),
        this.entityManager.find(Ticket, {
          where: baseWhere,
          take: rows,
          skip: page * rows,
          order: { slaResolutionDeadline: 'ASC' },
        }),
      ]);

    const statusCounts: Record<string, number> = {};
    statusCountsResult.forEach((s) => {
      if (s.statusName) {
        statusCounts[s.statusName] = parseInt(s.count, 10) || 0;
      }
    });

    return {
      total,
      overdueCount,
      dueTodayCount,
      statusCounts,
      data,
    };
  }

  async getCalendarTicketCounts(
    userId: number,
    activeCompanyId?: number,
    from?: string,
    to?: string,
  ): Promise<Record<string, number>> {
    const permIds = await this.getPermissionIdsByUserId(userId);
    if (!permIds.length) return {};

    // Fetch ALL open tickets assigned to this user — no date filter here.
    // We determine the calendar date per ticket below and filter in memory so
    // that tickets without an SLA (null slaResolutionDeadline) still appear.
    const filters: any[] = [
      { field: 'assigneeId', matchMode: 'in', value: permIds },
      {
        field: 'status.base',
        matchMode: 'notEquals',
        value: StatusBaseEnum.FINISHED,
      },
    ];

    const result = await this.searchWithStatus(
      { first: 0, rows: 500, filters, multiSorts: [], withRelations: [] },
      activeCompanyId,
    );

    // Date window boundaries (inclusive) — compare as YYYY-MM-DD strings
    const fromStr = from ?? null;
    const toStr = to ?? null;

    const counts: Record<string, number> = {};
    for (const ticket of result.data as Array<Record<string, unknown>>) {
      const slaDeadline = ticket['slaResolutionDeadline'] as
        | string
        | null
        | undefined;
      const createdAt = ticket['createdAt'] as string | null | undefined;

      let d: string;

      if (slaDeadline) {
        const slaDate = new Date(slaDeadline).toISOString().split('T')[0];

        if (fromStr && slaDate < fromStr) {
          // SLA already breached (overdue) → pin to today so it still shows
          d = fromStr;
        } else if (toStr && slaDate > toStr) {
          // Outside the forward window — skip
          continue;
        } else {
          d = slaDate;
        }
      } else {
        // No SLA — fall back to creation date
        if (!createdAt) continue;
        d = new Date(createdAt).toISOString().split('T')[0];

        // Apply normal window filter for creation-date fallback
        if (fromStr && d < fromStr) continue;
        if (toStr && d > toStr) continue;
      }

      counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SLA DEADLINE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Computes slaResponseDeadline and slaResolutionDeadline from the ticket's
   * createdAt and the linked TicketSla policy hours.
   *
   * Returns NULL for both when:
   *  - ticketSlaId is null/undefined (no SLA assigned), OR
   *  - the ticket status base is 'Finished' (breach clock frozen)
   *
   * Call this whenever ticketSlaId OR statusId changes on a ticket.
   */
  private async computeSlaDeadlines(
    ticketId: number,
    ticketSlaId: number | null | undefined,
    statusBase: string | null | undefined, // Changed type to match entity string
    createdAt?: Date, // 💡 Performance optimization parameter
    responseTime?: number | null,
    resolutionTime?: number | null,
  ): Promise<{
    slaResponseDeadline: Date | null;
    slaResolutionDeadline: Date | null;
  }> {
    const nullResult = {
      slaResponseDeadline: null,
      slaResolutionDeadline: null,
    };

    // Freeze when Finished
    if (statusBase === 'FINISHED' || statusBase === 'Finished') return nullResult;

    let rTime = responseTime;
    let resTime = resolutionTime;
    let ticketCreatedAt = createdAt;

    if (rTime === undefined || resTime === undefined || !ticketCreatedAt || statusBase === undefined || statusBase === null) {
      const ticket = await this.entityManager.findOne(Ticket, {
        where: { id: ticketId },
        select: ['id', 'createdAt', 'slaResponseTime', 'slaResolutionTime', 'statusBase'],
      });
      if (!ticket) return nullResult;
      if (rTime === undefined) rTime = ticket.slaResponseTime;
      if (resTime === undefined) resTime = ticket.slaResolutionTime;
      if (!ticketCreatedAt) ticketCreatedAt = ticket.createdAt;
      if (statusBase === undefined || statusBase === null) statusBase = ticket.statusBase;
    }

    if (statusBase === 'FINISHED' || statusBase === 'Finished') return nullResult;
    if (!rTime && !resTime) return nullResult;
    if (!ticketCreatedAt) return nullResult;

    const baseMs = new Date(ticketCreatedAt).getTime();

    const slaResponseDeadline = rTime && rTime > 0
      ? new Date(baseMs + rTime * 60 * 1000)
      : null;
    const slaResolutionDeadline = resTime && resTime > 0
      ? new Date(baseMs + resTime * 60 * 1000)
      : null;

    return { slaResponseDeadline, slaResolutionDeadline };
  }

  async refreshSlaDeadlines(
    ticketId: number,
    ticketSlaId: number | null | undefined,
    statusBase: StatusBaseEnum | string | null | undefined,
    responseTime?: number | null,
    resolutionTime?: number | null,
  ): Promise<void> {
    try {
      const { slaResponseDeadline, slaResolutionDeadline } =
        await this.computeSlaDeadlines(
          ticketId,
          ticketSlaId,
          statusBase as string,
          undefined,
          responseTime,
          resolutionTime,
        );

      await this.entityManager.update(
        Ticket,
        { id: ticketId },
        {
          slaResponseDeadline: slaResponseDeadline as any,
          slaResolutionDeadline: slaResolutionDeadline as any,
        },
      );
    } catch (err) {
      console.error(
        `[SlaDeadline] Failed to refresh for ticketId=${ticketId}:`,
        err,
      );
    }
  }

  async getMyTicketSpaces(
    userId: number,
    activeCompanyId?: number,
    viewAll = false,
  ): Promise<
    {
      id: number;
      name: string;
      prefix: string;
      completedCount: number;
      totalCount: number;
    }[]
  > {
    const companyFilter =
      activeCompanyId && activeCompanyId !== 0
        ? `AND ts."companyId" = ${activeCompanyId}`
        : '';

    let rows: {
      id: number;
      name: string;
      prefix: string;
      completedcount: string;
      totalcount: string;
    }[];

    if (viewAll) {
      // Admin/manager path – return every space for the company
      rows = await this.entityManager.query(
        `SELECT ts.id, ts.name, ts.prefix,
                COUNT(CASE WHEN s.base = 'Finished' THEN t.id END) AS completedcount,
                COUNT(t.id) AS totalcount
         FROM ticket_space ts
         LEFT JOIN ticket t ON t."ticketSpaceId" = ts.id
         LEFT JOIN status s ON s.id = t."statusId"
         WHERE 1=1 ${companyFilter}
         GROUP BY ts.id, ts.name, ts.prefix
         ORDER BY ts.id ASC`,
      );
    } else {
      // Member-only path – only spaces where the user has a ticket_space_member entry
      rows = await this.entityManager.query(
        `SELECT ts.id, ts.name, ts.prefix,
                COUNT(CASE WHEN s.base = 'Finished' THEN t.id END) AS completedcount,
                COUNT(t.id) AS totalcount
         FROM ticket_space ts
         INNER JOIN ticket_space_member tp
           ON tp."ticketSpaceId" = ts.id
           AND tp."userId" = $1
         LEFT JOIN ticket t ON t."ticketSpaceId" = ts.id
         LEFT JOIN status s ON s.id = t."statusId"
         WHERE 1=1 ${companyFilter}
         GROUP BY ts.id, ts.name, ts.prefix
         ORDER BY ts.id ASC`,
        [userId],
      );
    }

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      prefix: r.prefix,
      completedCount: Number(r.completedcount),
      totalCount: Number(r.totalcount),
    }));
  }

  private async transformTicketToDto(ticket: Ticket): Promise<any> {
    const resolveFullName = async (
      email: string | null | undefined,
    ): Promise<string | null | undefined> => {
      if (!email) return email;
      const user = await this.entityManager
        .getRepository(User)
        .findOne({ where: { email }, select: ['first_name', 'last_name'] });
      return user ? `${user.first_name} ${user.last_name}`.trim() : email;
    };

    const [createdByName, updatedByName] = await Promise.all([
      resolveFullName(ticket.createdBy),
      resolveFullName(ticket.updatedBy),
    ]);

    return {
      ...ticket,
      completionDate: ticket.completionDate
        ? typeof ticket.completionDate === 'string'
          ? (ticket.completionDate as unknown as string).split('T')[0]
          : ticket.completionDate.toISOString().split('T')[0]
        : undefined,
      createdBy: createdByName,
      updatedBy: updatedByName,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  private async updateDenormalizedFields(
    ticket: Ticket,
    dto: CreateTicketDto | UpdateTicketDto,
  ): Promise<void> {
    const castDto = dto as any;
    let status: TicketSpaceStatusConfig | null = null;
    let oldStatusId: number | null = null;

    if (dto.statusId) {
      if (castDto.status) {
        status = castDto.status as TicketSpaceStatusConfig;
      } else {
        status = await this.entityManager.findOne(TicketSpaceStatusConfig, {
          where: { id: dto.statusId },
        });

        console.log('status', status);
      }

      if (status) {
        ticket.statusName = status.name;
        ticket.statusColor = status.color;
        ticket.statusBase = status.base ?? '';
      }
    }

    if (dto.severityId) {
      let severity;
      if (castDto.severity) {
        severity = castDto.severity as any;
      } else {
        severity = await this.entityManager.findOne(TicketSpaceSeverityConfig, {
          where: { id: dto.severityId },
        });

        console.log('severity', severity);
      }
      if (severity) {
        ticket.severityName = severity.name;
        ticket.severityColor = severity.color;
        ticket.slaResponseTime = severity.responseTimeInMinutes ?? 0;
        ticket.slaResolutionTime = severity.resolutionTimeInMinutes ?? 0;
      }
    }

    if (dto.ticketTypeId) {
      let ticketType;
      if (castDto.ticketType) {
        ticketType = castDto.ticketType as any;
      } else {
        ticketType = await this.entityManager.findOne(TicketSpaceTypeConfig, {
          where: { id: dto.ticketTypeId },
        });

        console.log('ticketType', ticketType);
      }
      if (ticketType) {
        ticket.ticketTypeName = ticketType.name;
        ticket.ticketTypeIcon = ticketType.icon;
      }
    }

    if (dto.departmentId) {
      let department;
      if (castDto.department) {
        department = castDto.department;
      } else {
        department = await this.entityManager.findOne(Division, {
          where: { id: dto.departmentId },
        });

        console.log('department', department);
      }
      if (department) {
        ticket.departmentName = department.division;
      }
    }

    if (dto.queueId) {
      let queue;
      if (castDto.queue) {
        queue = castDto.queue;
      } else {
        queue = await this.entityManager.findOne(TicketQueue, {
          where: { id: dto.queueId },
        });

        console.log('queue', queue);
      }
      if (queue) {
        ticket.queueName = queue.name;
      }
    }

    if (dto.impactId) {
      let impact;
      if (castDto.impact) {
        impact = castDto.impact;
      } else {
        impact = await this.entityManager.findOne(TicketImpact, {
          where: { id: dto.impactId },
        });

        console.log('impact', impact);
      }
      if (impact) {
        ticket.impactName = impact.name;
      }
    }


    if (dto.assigneeId) {
      let permission;
      if (castDto.assignee) {
        permission = castDto.assignee;
      } else {
        permission = await this.entityManager.findOne(TicketSpaceMember, {
          where: { id: dto.assigneeId },
        });

        console.log('permission', permission);
      }
      if (permission) {
        ticket.assigneeName =
          `${permission.userFirstName ?? permission.first_name ?? ''} ${permission.userLastName ?? permission.last_name ?? ''}`.trim();
        ticket.assigneeProfilePicUrl =
          permission.userProfilePicture ?? permission.profile_picture ?? '';
        ticket.assigneeEmail = permission.userEmail ?? permission.email ?? '';
      }
    }
  }
}
