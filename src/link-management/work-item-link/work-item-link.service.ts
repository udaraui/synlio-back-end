import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { WorkItemLink } from './work-item-link.entity';
import {
  CreateWorkItemLinkDto,
  UpdateWorkItemLinkDto,
} from './dto/work-item-link.dto';
import { PostType } from '../../common/enum/post-type.enum';
import { Task } from '../../task-management/task/task.entity';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { LinkType } from '../link-type/link-type.entity';

interface ResolvedItem {
  id: number;
  type: PostType;
  spaceId: number | null;
  companyId: number | null;
}

@Injectable()
export class WorkItemLinkService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async createLink(dto: CreateWorkItemLinkDto, authUser: any) {
    if (dto.sourceType === dto.targetType && dto.sourceId === dto.targetId) {
      throw new BadRequestException('A work item cannot be linked to itself');
    }

    const source = await this.resolveItem(dto.sourceType, dto.sourceId);
    const target = await this.resolveItem(dto.targetType, dto.targetId);

    // Same-space vs cross-space membership check (see flowchart)
    const sameSpace =
      source.type === target.type && source.spaceId === target.spaceId;
    if (!sameSpace) {
      const userId = authUser?.userId ?? authUser?.id;
      const isMember = await this.isMemberOfSpace(
        target.type,
        target.spaceId,
        userId,
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Access denied: you are not a member of the target space',
        );
      }
    }

    // Duplicate check (both directions)
    const duplicate = await this.findExistingLink(source, target);
    if (duplicate) {
      throw new BadRequestException(
        'A link between these two work items already exists',
      );
    }

    // Link type is required
    const linkType = await this.entityManager.findOne(LinkType, {
      where: { id: dto.linkTypeId },
    });
    if (!linkType) {
      throw new BadRequestException('Invalid link type');
    }

    const link = new WorkItemLink();
    link.sourceType = dto.sourceType;
    link.sourceId = dto.sourceId;
    link.targetType = dto.targetType;
    link.targetId = dto.targetId;
    link.linkTypeId = dto.linkTypeId;
    link.linkTypeName = linkType.name;
    link.linkTargetTypeName = linkType.targetName ?? linkType.name;
    link.note = dto.note?.trim() || null;
    link.companyId = source.companyId ?? target.companyId ?? null;
    link.createdBy = authUser?.email;
    link.updatedBy = authUser?.email;

    const saved = await this.entityManager.save(WorkItemLink, link);
    return saved;
  }

  async checkAccess(type: PostType, id: number, authUser: any) {
    const reqPrivilegeId = type === PostType.TSK ? 106 : 105;
    const privilegesArray = Array.isArray(authUser?.privileges)
      ? authUser.privileges
      : [];
    const hasViewAll =
      privilegesArray.some(
        (p: any) =>
          Array.isArray(p?.privilegeIds) &&
          p.privilegeIds.includes(reqPrivilegeId),
      ) ||
      (Array.isArray(authUser?.privilegeIds) &&
        authUser.privilegeIds.includes(reqPrivilegeId));

    if (hasViewAll) {
      return { hasAccess: true };
    }

    const item = await this.resolveItem(type, id);
    const userId = authUser?.userId ?? authUser?.id;
    const isMember = await this.isMemberOfSpace(type, item.spaceId, userId);
    if (!isMember) {
      return {
        hasAccess: false,
        message: 'Sorry, you must be a member of the space to view this item',
      };
    }
    return { hasAccess: true };
  }

  /** All links attached to a work item (from either side), enriched with the
   *  opposite item's display fields. */
  async getLinksForItem(type: PostType, id: number) {
    const links = await this.entityManager.find(WorkItemLink, {
      where: [
        { sourceType: type, sourceId: id },
        { targetType: type, targetId: id },
      ],
      relations: ['linkType'],
      order: { createdAt: 'desc' },
    });

    // Determine the "other" item for each link
    const otherRefs = links.map((l) => this.otherSide(l, type, id));
    const taskIds = otherRefs
      .filter((r) => r.type === PostType.TSK)
      .map((r) => r.id);
    const ticketIds = otherRefs
      .filter((r) => r.type === PostType.TKT)
      .map((r) => r.id);

    const [tasks, tickets] = await Promise.all([
      taskIds.length
        ? this.entityManager.find(Task, { where: { id: In(taskIds) } })
        : Promise.resolve([] as Task[]),
      ticketIds.length
        ? this.entityManager.find(Ticket, { where: { id: In(ticketIds) } })
        : Promise.resolve([] as Ticket[]),
    ]);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const ticketMap = new Map(tickets.map((t) => [t.id, t]));

    const data = links.map((l, i) => {
      const ref = otherRefs[i];
      const item =
        ref.type === PostType.TSK
          ? this.normalizeTask(taskMap.get(ref.id))
          : this.normalizeTicket(ticketMap.get(ref.id));
      const isSource = l.sourceType === type && l.sourceId === id;
      const linkTypeName = isSource
        ? (l.linkTypeName ?? l.linkType?.name ?? null)
        : (l.linkTargetTypeName ??
          l.linkType?.targetName ??
          l.linkType?.name ??
          null);
      return {
        linkId: l.id,
        linkTypeId: l.linkTypeId,
        linkTypeName,
        linkTypeColor: l.linkType?.color ?? null,
        note: l.note,
        createdBy: l.createdBy,
        createdAt: l.createdAt,
        updatedBy: l.updatedBy,
        updatedAt: l.updatedAt,
        item,
      };
    });

    return { links: data.filter((d) => d.item) };
  }

  async updateLink(id: number, dto: UpdateWorkItemLinkDto, authUser: any) {
    const link = await this.entityManager.findOne(WorkItemLink, {
      where: { id },
    });
    if (!link) throw new NotFoundException(`Link ${id} not found`);

    if (dto.linkTypeId !== undefined) {
      const linkType = await this.entityManager.findOne(LinkType, {
        where: { id: dto.linkTypeId },
      });
      if (!linkType) {
        throw new BadRequestException('Invalid link type');
      }
      link.linkTypeId = dto.linkTypeId;
      link.linkTypeName = linkType.name;
      link.linkTargetTypeName = linkType.targetName ?? linkType.name;
    }
    if (dto.note !== undefined) link.note = dto.note?.trim() || null;
    link.updatedBy = authUser?.email;

    return this.entityManager.save(WorkItemLink, link);
  }

  async deleteLink(id: number) {
    const link = await this.entityManager.findOne(WorkItemLink, {
      where: { id },
    });
    if (!link) throw new NotFoundException(`Link ${id} not found`);
    await this.entityManager.delete(WorkItemLink, id);
    return { message: 'Link removed', status: 200 };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private otherSide(
    link: WorkItemLink,
    type: PostType,
    id: number,
  ): { type: PostType; id: number } {
    const isSource = link.sourceType === type && link.sourceId === id;
    return isSource
      ? { type: link.targetType, id: link.targetId }
      : { type: link.sourceType, id: link.sourceId };
  }

  private async resolveItem(type: PostType, id: number): Promise<ResolvedItem> {
    if (type === PostType.TSK) {
      const task = await this.entityManager.findOne(Task, {
        where: { id },
        select: ['id', 'taskSpaceId', 'companyId'],
      });
      if (!task) throw new NotFoundException(`Task ${id} not found`);
      return {
        id,
        type,
        spaceId: task.taskSpaceId,
        companyId: task.companyId,
      };
    }
    const ticket = await this.entityManager.findOne(Ticket, {
      where: { id },
      select: ['id', 'ticketSpaceId', 'companyId'],
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return {
      id,
      type,
      spaceId: ticket.ticketSpaceId,
      companyId: ticket.companyId,
    };
  }

  private async findExistingLink(
    a: ResolvedItem,
    b: ResolvedItem,
  ): Promise<WorkItemLink | null> {
    return this.entityManager.findOne(WorkItemLink, {
      where: [
        {
          sourceType: a.type,
          sourceId: a.id,
          targetType: b.type,
          targetId: b.id,
        },
        {
          sourceType: b.type,
          sourceId: b.id,
          targetType: a.type,
          targetId: a.id,
        },
      ],
    });
  }

  /** Is the user a member of the given space? Task: owner or resource of the
   *  space. Ticket: has a ticket permission in the space. */
  private async isMemberOfSpace(
    type: PostType,
    spaceId: number | null,
    userId: number | undefined,
  ): Promise<boolean> {
    if (!spaceId || !userId) return false;

    if (type === PostType.TSK) {
      const rows: unknown[] = await this.entityManager.query(
        `SELECT 1
           FROM task_space_owners
          WHERE "taskSpaceId" = $1 AND "userId" = $2
          UNION
         SELECT 1
           FROM task_space_resources tsr
           JOIN resource r ON r.id = tsr."resourceId"
          WHERE tsr."taskSpaceId" = $1 AND r."userId" = $2
          LIMIT 1`,
        [spaceId, userId],
      );
      return rows.length > 0;
    }

    const rows: unknown[] = await this.entityManager.query(
      `SELECT 1 FROM ticket_space_member
        WHERE "ticketSpaceId" = $1 AND "userId" = $2 LIMIT 1`,
      [spaceId, userId],
    );
    return rows.length > 0;
  }

  private normalizeTask(t?: Task) {
    if (!t) return null;
    return {
      id: t.id,
      type: PostType.TSK,
      code: t.code,
      name: t.name,
      spaceName: t.taskSpaceName ?? null,
      severityName: t.severityName ?? null,
      severityColor: t.severityColor ?? null,
      statusName: t.statusName ?? null,
      statusColor: t.statusColor ?? null,
      startDate: t.startDate ?? null,
      dueDate: t.dueDate ?? null,
      assigneeName: t.assigneeName ?? null,
      assigneeProfilePicUrl: t.assigneeProfilePicUrl ?? null,
      typeIcon: t.hierarchyLevelIcon ?? null,
      typeColor: t.hierarchyLevelColor ?? null,
      typeName: t.hierarchyLevelName ?? null,
    };
  }

  private normalizeTicket(t?: Ticket) {
    if (!t) return null;
    return {
      id: t.id,
      type: PostType.TKT,
      code: t.code,
      name: t.name,
      spaceName: t.ticketSpaceName ?? null,
      severityName: t.severityName ?? null,
      severityColor: t.severityColor ?? null,
      statusName: t.statusName ?? null,
      statusColor: t.statusColor ?? null,
      startDate: t.createdAt ?? null,
      dueDate: t.slaResolutionDeadline ?? t.completionDate ?? null,
      assigneeName: t.assigneeName ?? null,
      assigneeProfilePicUrl: t.assigneeProfilePicUrl ?? null,
      typeIcon: t.ticketTypeIcon ?? null,
      typeColor: null,
      typeName: t.ticketTypeName ?? null,
    };
  }
}
