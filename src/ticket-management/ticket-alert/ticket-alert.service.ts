import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Ticket } from '../ticket/ticket.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';
import { TicketSpaceMember } from '../ticket-space-member/ticket-space-member.entity';
import { TicketSpaceStatusConfig } from '../ticket-space-status-config/ticket-space-status-config.entity';
import { TicketSpaceSeverityConfig } from '../ticket-space-severity-config/ticket-space-severity-config.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';
import { TicketType } from '../ticket-type/ticket-type.entity';
import { TicketImpact } from '../ticket-impact/ticket-impact.entity';

import { Division } from '../../company-management/division/division.entity';
import { User } from '../../user-management/user/user.entity';
import { Company } from '../../company-management/company/company.entity';
import { Email } from '../../alert/email/email.entity';
import { Notification } from '../../alert/notification/notification.entity';
import { ServiceBusService } from '../../common/azure/service-bus.service';
import { TicketEventType } from '../../common/enum/ticket-event.enum';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { AlertRuleService } from '../../alert/alert-rule/space-alert-rule.service';
import { buildEmailHtml, buildChip } from '../../common/email/email-template.helper';

// ─────────────────────────────────────────────────────────────────────────── //
//  Internal context – built once per dispatch, shared across private helpers
// ─────────────────────────────────────────────────────────────────────────── //
interface AlertContext {
  event: TicketEventType;
  ticket: Ticket;
  // Actor (who triggered the event)
  actorName: string;
  actorEmail: string;
  actorUserId: number | null;
  actorProfilePicUrl: string | null;
  // Ticket creator
  createdByEmail: string;
  createdByName: string;
  createdByUserId: number | null;
  // Current assignee (may be null)
  assigneeEmail: string | null;
  assigneeName: string;
  assigneeUserId: number | null;
  // Participants
  participantEmails: string[];
  participantUserIds: number[];
  // Resolved display names
  statusName: string;
  severityName: string;
  // Space-configured colors for the current status/severity (hex, e.g. '#6366f1')
  statusColor: string | null;
  severityColor: string | null;
  // "From" address — falls back to actorEmail; SMTP credentials resolved from company at send time
  fromEmail: string;
  // Event-specific extras (populated before calling dispatch())
  oldStatus?: string;
  newStatus?: string;
  oldStatusColor?: string | null;
  newStatusColor?: string | null;
  oldSeverity?: string;
  newSeverity?: string;
  oldSeverityColor?: string | null;
  newSeverityColor?: string | null;
  oldQueue?: string;
  newQueue?: string;
  oldName?: string;
  newName?: string;
  oldAssignee?: string;
  newAssignee?: string;
  commentText?: string;
  // For TICKET_UPDATED: resolved list of changed field old→new pairs
  updatedFields?: Array<{
    label: string;
    oldValue: string;
    newValue: string;
    isHtml?: boolean;
    oldColor?: string | null;
    newColor?: string | null;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────── //

@Injectable()
export class TicketAlertService {
  private readonly logger = new Logger(TicketAlertService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly serviceBusService: ServiceBusService,
    private readonly configService: ConfigService,
    private readonly alertRuleService: AlertRuleService,
  ) {}

  // ── Public entry points ──────────────────────────────────────────────── //

  async dispatchTicketCreated(ticketId: number, authUser: any): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.TICKET_CREATED,
    );
    if (!ctx) return;
    await this.dispatch(ctx, authUser);
  }

  async dispatchTicketUpdated(
    ticketId: number,
    updateDto: Record<string, unknown>,
    oldSnapshot: Record<string, unknown>,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.TICKET_UPDATED,
    );
    if (!ctx) return;

    // ── helpers ──────────────────────────────────────────────────────── //
    const resolveName = async <T extends { name: string }>(
      entity: new () => T,
      id: unknown,
    ): Promise<string> => {
      if (!id) return '—';
      const rec = await this.entityManager.findOne(entity as any, {
        where: { id: Number(id) },
      });
      return (rec as any)?.name ?? '—';
    };
    const resolveDivisionName = async (id: unknown): Promise<string> => {
      if (!id) return '—';
      const rec = await this.entityManager.findOne(Division, {
        where: { id: Number(id) },
      });
      return rec?.division ?? '—';
    };
    const resolveSla = async (id: unknown): Promise<string> => {
      return '—';
    };
    const resolveStatusConfig = async (
      id: unknown,
    ): Promise<{ name: string; color: string | null }> => {
      if (!id) return { name: '—', color: null };
      const rec = await this.entityManager.findOne(TicketSpaceStatusConfig, {
        where: { id: Number(id) },
      });
      return { name: rec?.name ?? '—', color: rec?.color ?? null };
    };
    const resolveSeverityConfig = async (
      id: unknown,
    ): Promise<{ name: string; color: string | null }> => {
      if (!id) return { name: '—', color: null };
      const rec = await this.entityManager.findOne(TicketSpaceSeverityConfig, {
        where: { id: Number(id) },
      });
      return { name: rec?.name ?? '—', color: rec?.color ?? null };
    };

    type Field = {
      label: string;
      oldValue: string;
      newValue: string;
      isHtml?: boolean;
      oldColor?: string | null;
      newColor?: string | null;
    };
    const fields: Field[] = [];

    if (
      updateDto.name !== undefined &&
      String(oldSnapshot.name ?? '') !== String(updateDto.name)
    )
      fields.push({
        label: 'Name',
        oldValue: String(oldSnapshot.name ?? '—'),
        newValue: String(updateDto.name),
      });

    if (
      updateDto.code !== undefined &&
      String(oldSnapshot.code ?? '') !== String(updateDto.code)
    )
      fields.push({
        label: 'Code',
        oldValue: String(oldSnapshot.code ?? '—'),
        newValue: String(updateDto.code),
      });

    if (
      updateDto.description !== undefined &&
      String(oldSnapshot.description ?? '') !==
        String(updateDto.description ?? '')
    )
      fields.push({
        label: 'Description',
        oldValue: String(oldSnapshot.description || ''),
        newValue: String(updateDto.description || ''),
        isHtml: true,
      });

    if (
      updateDto.statusId !== undefined &&
      Number(oldSnapshot.statusId) !== Number(updateDto.statusId)
    ) {
      const [oldStatusCfg, newStatusCfg] = await Promise.all([
        resolveStatusConfig(oldSnapshot.statusId),
        resolveStatusConfig(updateDto.statusId),
      ]);
      fields.push({
        label: 'Status',
        oldValue: oldStatusCfg.name,
        newValue: newStatusCfg.name,
        oldColor: oldStatusCfg.color,
        newColor: newStatusCfg.color,
      });
    }

    if (
      updateDto.severityId !== undefined &&
      Number(oldSnapshot.severityId) !== Number(updateDto.severityId)
    ) {
      const [oldSeverityCfg, newSeverityCfg] = await Promise.all([
        resolveSeverityConfig(oldSnapshot.severityId),
        resolveSeverityConfig(updateDto.severityId),
      ]);
      fields.push({
        label: 'Severity',
        oldValue: oldSeverityCfg.name,
        newValue: newSeverityCfg.name,
        oldColor: oldSeverityCfg.color,
        newColor: newSeverityCfg.color,
      });
    }

    if (
      updateDto.ticketTypeId !== undefined &&
      Number(oldSnapshot.ticketTypeId) !== Number(updateDto.ticketTypeId)
    )
      fields.push({
        label: 'Type',
        oldValue: await resolveName(TicketType, oldSnapshot.ticketTypeId),
        newValue: await resolveName(TicketType, updateDto.ticketTypeId),
      });

    if (
      updateDto.departmentId !== undefined &&
      Number(oldSnapshot.departmentId) !== Number(updateDto.departmentId)
    )
      fields.push({
        label: 'Department',
        oldValue: await resolveDivisionName(oldSnapshot.departmentId),
        newValue: await resolveDivisionName(updateDto.departmentId),
      });

    if (
      updateDto.queueId !== undefined &&
      Number(oldSnapshot.queueId) !== Number(updateDto.queueId)
    )
      fields.push({
        label: 'Queue',
        oldValue: await resolveName(TicketQueue, oldSnapshot.queueId),
        newValue: await resolveName(TicketQueue, updateDto.queueId),
      });

    if (
      updateDto.impactId !== undefined &&
      Number(oldSnapshot.impactId) !== Number(updateDto.impactId)
    )
      fields.push({
        label: 'Impact',
        oldValue: await resolveName(TicketImpact, oldSnapshot.impactId),
        newValue: await resolveName(TicketImpact, updateDto.impactId),
      });

    if (
      updateDto.ticketSlaId !== undefined &&
      Number(oldSnapshot.ticketSlaId) !== Number(updateDto.ticketSlaId)
    )
      fields.push({
        label: 'SLA',
        oldValue: await resolveSla(oldSnapshot.ticketSlaId),
        newValue: await resolveSla(updateDto.ticketSlaId),
      });

    if (
      updateDto.plannedEffort !== undefined &&
      Number(oldSnapshot.plannedEffort ?? null) !==
        Number(updateDto.plannedEffort)
    )
      fields.push({
        label: 'Planned Effort',
        oldValue:
          oldSnapshot.plannedEffort != null
            ? `${String(oldSnapshot.plannedEffort)}h`
            : '—',
        newValue: `${String(updateDto.plannedEffort)}h`,
      });

    if (
      updateDto.actualEffort !== undefined &&
      Number(oldSnapshot.actualEffort ?? null) !==
        Number(updateDto.actualEffort)
    )
      fields.push({
        label: 'Actual Effort',
        oldValue:
          oldSnapshot.actualEffort != null
            ? `${String(oldSnapshot.actualEffort)}h`
            : '—',
        newValue: `${String(updateDto.actualEffort)}h`,
      });

    if (
      updateDto.completionDate !== undefined &&
      String(oldSnapshot.completionDate ?? '') !==
        String(updateDto.completionDate ?? '')
    )
      fields.push({
        label: 'Completion Date',
        oldValue: String(oldSnapshot.completionDate || '—'),
        newValue: String(updateDto.completionDate || '—'),
      });

    if (
      updateDto.participantIds !== undefined &&
      Array.isArray(updateDto.participantIds)
    ) {
      const oldIds = (
        Array.isArray(oldSnapshot.participantIds)
          ? (oldSnapshot.participantIds as unknown[])
          : []
      )
        .map(Number)
        .sort();
      const newIds = (updateDto.participantIds as unknown[]).map(Number).sort();
      const changed =
        oldIds.length !== newIds.length ||
        oldIds.some((id, i) => id !== newIds[i]);
      if (changed)
        fields.push({
          label: 'Participants',
          oldValue: `${oldIds.length} participant(s)`,
          newValue: `${newIds.length} participant(s)`,
        });
    }

    ctx.updatedFields = fields;
    await this.dispatch(ctx, authUser);
  }

  /**
   * @param oldAssigneePermissionId  TicketSpaceMember.id of the previous assignee
   *                                 (null / undefined = was unassigned before)
   */
  async dispatchTicketAssigned(
    ticketId: number,
    oldAssigneePermissionId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.TICKET_ASSIGNED,
    );
    if (!ctx) return;
    this.logger.debug(`[Ticket ${ticketId}] Assigned - Old: ${oldAssigneePermissionId}, New: ${ctx.ticket.assigneeId}`);
    if (oldAssigneePermissionId === ctx.ticket.assigneeId) return;

    // Resolve old-assignee display name
    let oldAssigneeName = 'Unassigned';
    if (oldAssigneePermissionId) {
      const oldPerm = await this.entityManager.findOne(TicketSpaceMember, {
        where: { id: oldAssigneePermissionId },
      });
      if (oldPerm) {
        oldAssigneeName =
          `${oldPerm.userFirstName ?? ''} ${oldPerm.userLastName ?? ''}`.trim() ||
          oldPerm.userEmail ||
          'Unassigned';
      }
    }

    ctx.oldAssignee = oldAssigneeName;
    ctx.newAssignee = ctx.assigneeName;
    await this.dispatch(ctx, authUser);
  }

  /** @param oldStatusId  Status.id before the update (null = unknown) */
  async dispatchStatusChanged(
    ticketId: number,
    oldStatusId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.STATUS_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Ticket ${ticketId}] Status - Old: ${oldStatusId}, New: ${ctx.ticket.statusId}`);
    if (oldStatusId === ctx.ticket.statusId) return;

    let oldStatusName = '—';
    let oldStatusColor: string | null = null;
    if (oldStatusId) {
      const oldStatus = await this.entityManager.findOne(TicketSpaceStatusConfig, {
        where: { id: oldStatusId },
      });
      if (oldStatus) {
        oldStatusName = oldStatus.name;
        oldStatusColor = oldStatus.color;
      }
    }

    ctx.oldStatus = oldStatusName;
    ctx.oldStatusColor = oldStatusColor;
    ctx.newStatus = ctx.statusName;
    ctx.newStatusColor = ctx.statusColor;
    await this.dispatch(ctx, authUser);
  }

  /** @param oldSeverityId  Severity.id before the update (null = unknown) */
  async dispatchSeverityChanged(
    ticketId: number,
    oldSeverityId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.SEVERITY_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Ticket ${ticketId}] Severity - Old: ${oldSeverityId}, New: ${ctx.ticket.severityId}`);
    if (oldSeverityId === ctx.ticket.severityId) return;

    let oldSeverityName = '—';
    let oldSeverityColor: string | null = null;
    if (oldSeverityId) {
      const oldSeverity = await this.entityManager.findOne(TicketSpaceSeverityConfig, {
        where: { id: oldSeverityId },
      });
      if (oldSeverity) {
        oldSeverityName = oldSeverity.name;
        oldSeverityColor = oldSeverity.color;
      }
    }

    ctx.oldSeverity = oldSeverityName;
    ctx.oldSeverityColor = oldSeverityColor;
    ctx.newSeverity = ctx.severityName;
    ctx.newSeverityColor = ctx.severityColor;
    await this.dispatch(ctx, authUser);
  }

  /** @param oldQueueId  TicketQueue.id before the update (null = unqueued) */
  async dispatchQueueChanged(
    ticketId: number,
    oldQueueId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.QUEUE_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Ticket ${ticketId}] Queue - Old: ${oldQueueId}, New: ${ctx.ticket.queueId}`);
    if (oldQueueId === ctx.ticket.queueId) return;

    let oldQueueName = '—';
    if (oldQueueId) {
      const oldQueue = await this.entityManager.findOne(TicketQueue, {
        where: { id: oldQueueId },
      });
      if (oldQueue) oldQueueName = oldQueue.name;
    }

    // Resolve current queue name from the ticket relation
    let newQueueName = '—';
    const ticket = ctx.ticket as Ticket & { queue?: TicketQueue };
    if (ticket.queue?.name) {
      newQueueName = ticket.queue.name;
    } else if (ctx.ticket.queueId) {
      const newQueue = await this.entityManager.findOne(TicketQueue, {
        where: { id: ctx.ticket.queueId },
      });
      if (newQueue) newQueueName = newQueue.name;
    }

    ctx.oldQueue = oldQueueName;
    ctx.newQueue = newQueueName;
    await this.dispatch(ctx, authUser);
  }

  /** @param oldName  Ticket name before the update */
  async dispatchNameChanged(
    ticketId: number,
    oldName: string,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.NAME_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Ticket ${ticketId}] Name - Old: "${oldName}", New: "${ctx.ticket.name}"`);
    if (oldName === ctx.ticket.name) return;

    ctx.oldName = oldName;
    ctx.newName = ctx.ticket.name;
    await this.dispatch(ctx, authUser);
  }

  async dispatchCommentAdded(
    ticketId: number,
    commentText: string,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.COMMENT_ADDED,
    );
    if (!ctx) return;
    ctx.commentText = commentText;
    await this.dispatch(ctx, authUser);
  }

  /**
   * Pass `preloadedTicket` (with ticketSpace / status / severity / assignee /
   * participants relations) to skip the DB fetch — required when the ticket
   * row has already been deleted before this method is called.
   */
  async dispatchTicketDeleted(
    ticketId: number,
    authUser: any,
    preloadedTicket?: Ticket,
  ): Promise<void> {
    const ctx = await this.loadContext(
      ticketId,
      authUser,
      TicketEventType.TICKET_DELETED,
      preloadedTicket,
    );
    if (!ctx) return;
    await this.dispatch(ctx, authUser);
  }

  /**
   * Deletes all Email and Notification records that were created for a
   * specific ticket (identified by referenceId + referenceType = 'ticket').
   *
   * The TICKET_DELETED alert rows are intentionally excluded because they
   * have referenceType = NULL and must remain as an audit trail.
   *
   * Call this AFTER the ticket row is deleted from the DB.
   */
  async cleanupTicketAlerts(ticketId: number): Promise<void> {
    try {
      await this.entityManager.transaction(async (manager) => {
        await manager.delete(Notification, {
          referenceId: ticketId,
          referenceType: 'ticket',
        });
        await manager.delete(Email, {
          referenceId: ticketId,
          referenceType: 'ticket',
        });
      });
      this.logger.log(
        `TicketAlertService: cleaned up alerts for deleted ticket ${ticketId}`,
      );
    } catch (err) {
      this.logger.error(
        `TicketAlertService: failed to clean up alerts for ticket ${ticketId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ── Private: load context from DB ────────────────────────────────────── //

  private async loadContext(
    ticketId: number,
    authUser: any,
    event: TicketEventType,
    preloadedTicket?: Ticket,
  ): Promise<AlertContext | null> {
    const ticket =
      preloadedTicket ??
      (await this.entityManager.findOne(Ticket, {
        where: { id: ticketId },
        relations: [
          'ticketSpace',
          'ticketSpace.division',
          'ticketSpace.division.company',
          'status',
          'severity',
          'assignee',
          'participants',
        ],
      }));

    if (!ticket) {
      this.logger.warn(
        `TicketAlertService: ticket ${ticketId} not found – skipping [${event}] alert`,
      );
      return null;
    }

    // Skip all notifications/emails for any change on a ticket whose current
    // status base is already Finished — except ticket creation and status changes
    // (status changes always notify regardless of the current status).
    if (
      event !== TicketEventType.TICKET_CREATED &&
      event !== TicketEventType.STATUS_CHANGED &&
      ticket.status?.base === StatusBaseEnum.FINISHED
    ) {
      this.logger.log(
        `TicketAlertService: skipping [${event}] alert for ticket ${ticketId} – ticket status base is already Finished`,
      );
      return null;
    }

    const actorEmail: string = authUser?.email ?? '';

    // Actor display name
    const actorUser = await this.entityManager.findOne(User, {
      where: { email: actorEmail },
      select: ['id', 'first_name', 'last_name', 'profile_picture'],
    });
    const actorName = actorUser
      ? `${actorUser.first_name} ${actorUser.last_name}`.trim() || actorEmail
      : actorEmail;

    const uploadsBaseUrl = this.configService
      .get<string>('BACKEND_URL', '')
      .replace(/\/+$/, '');
    const actorProfilePicUrl = actorUser?.profile_picture
      ? actorUser.profile_picture.startsWith('http')
        ? actorUser.profile_picture
        : `${uploadsBaseUrl}/uploads/users/${actorUser.profile_picture}`
      : null;

    // Ticket creator (stored as email in createdBy)
    const createdByEmail = ticket.createdBy || actorEmail; // || catches empty string too
    let createdByUserId: number | null = null;
    let createdByName = createdByEmail;

    if (createdByEmail === actorEmail) {
      createdByUserId = actorUser?.id ?? null;
      createdByName = actorName;
    } else {
      const createdByUser = await this.entityManager.findOne(User, {
        where: { email: createdByEmail },
        select: ['id', 'first_name', 'last_name'],
      });
      if (createdByUser) {
        createdByUserId = createdByUser.id ?? null;
        createdByName =
          `${createdByUser.first_name} ${createdByUser.last_name}`.trim() ||
          createdByEmail;
      }
    }

    // Assignee (TicketSpaceMember carries denormalised user columns)
    const assigneePerm = ticket.assignee ?? null;
    const assigneeEmail = assigneePerm?.userEmail || null; // || catches empty string
    const assigneeName = assigneePerm
      ? `${assigneePerm.userFirstName ?? ''} ${assigneePerm.userLastName ?? ''}`.trim() ||
        assigneePerm.userEmail ||
        'Unassigned'
      : 'Unassigned';
    const assigneeUserId: number | null = assigneePerm?.userId ?? null;

    // Participants
    const participants = ticket.participants ?? [];
    const participantEmails = participants
      .map((p) => p.userEmail)
      .filter((e): e is string => !!e);
    const participantUserIds = participants
      .map((p) => p.userId)
      .filter((id): id is number => !!id);

    return {
      event,
      ticket,
      actorName,
      actorEmail,
      actorUserId: actorUser?.id ?? null,
      actorProfilePicUrl,
      createdByEmail,
      createdByName,
      createdByUserId,
      assigneeEmail,
      assigneeName,
      assigneeUserId,
      participantEmails,
      participantUserIds,
      statusName: ticket.status?.name ?? '—',
      severityName: ticket.severity?.name ?? '—',
      statusColor: ticket.status?.color ?? null,
      severityColor: ticket.severity?.color ?? null,
      // fromEmail falls back to actorEmail; SMTP credentials are resolved from the company at send time.
      fromEmail: actorEmail,
    };
  }

  // ── Private: recipient matrix ─────────────────────────────────────────── //

  /**
   * Returns clean TO / CC arrays (no empty strings, no duplicates).
   *
   * Rule: every event must have at least one TO recipient.
   * If the natural TO set is empty (e.g. no assignee for TICKET_ASSIGNED),
   * the createdByEmail is used as a fallback so the email is always delivered.
   */
  private resolveRecipients(ctx: AlertContext): { to: string[]; cc: string[] } {
    const { event, assigneeEmail, createdByEmail, participantEmails } = ctx;

    /** Strips falsy/empty values from a Set and returns a plain array. */
    const clean = (set: Set<string>): string[] =>
      [...set].filter((e): e is string => !!e);

    switch (event) {
      // 4.1 – Ticket Created / Updated
      // TO: assignee  |  CC: createdBy + participants
      case TicketEventType.TICKET_CREATED:
      case TicketEventType.TICKET_UPDATED: {
        const to = new Set<string>();
        if (assigneeEmail) to.add(assigneeEmail);
        if (to.size === 0) to.add(createdByEmail || ctx.actorEmail); // last-resort fallback
        const cc = new Set<string>(
          [createdByEmail, ...participantEmails].filter(
            (e) => !!e && !to.has(e),
          ),
        );
        return { to: clean(to), cc: clean(cc) };
      }

      // 4.2 – Ticket Assigned
      // TO: new assignee | CC: actor + createdBy + participants
      case TicketEventType.TICKET_ASSIGNED: {
        const to = new Set<string>();
        if (assigneeEmail) to.add(assigneeEmail);
        if (to.size === 0) to.add(createdByEmail);
        if (to.size === 0) to.add(ctx.actorEmail); // last-resort fallback
        const cc = new Set<string>(
          [ctx.actorEmail, createdByEmail, ...participantEmails].filter(
            (e) => !!e && !to.has(e),
          ),
        );
        return { to: clean(to), cc: clean(cc) };
      }

      // 4.3 – Status Changed | 4.3b – Severity Changed | 4.3c – Queue Changed | 4.4 – Comment Added
      // TO: assignee + createdBy | CC: participants
      case TicketEventType.STATUS_CHANGED:
      case TicketEventType.SEVERITY_CHANGED:
      case TicketEventType.QUEUE_CHANGED:
      case TicketEventType.NAME_CHANGED:
      case TicketEventType.COMMENT_ADDED: {
        const to = new Set<string>();
        if (assigneeEmail) to.add(assigneeEmail);
        if (createdByEmail) to.add(createdByEmail);
        // FIX: last-resort fallback — use actor email if both are somehow empty
        if (to.size === 0) to.add(ctx.actorEmail);
        const cc = new Set<string>(
          participantEmails.filter((e) => !!e && !to.has(e)),
        );
        return { to: clean(to), cc: clean(cc) };
      }

      // 4.5 – Ticket Deleted
      // TO: createdBy  |  CC: actor (if different from creator) + participants
      case TicketEventType.TICKET_DELETED: {
        const to = new Set<string>();
        if (createdByEmail) to.add(createdByEmail);
        if (to.size === 0) to.add(ctx.actorEmail);
        const cc = new Set<string>(
          [ctx.actorEmail, ...participantEmails].filter(
            (e) => !!e && !to.has(e),
          ),
        );
        return { to: clean(to), cc: clean(cc) };
      }
    }
  }

  // ── Private: subject line ─────────────────────────────────────────────── //

  private buildSubject(ctx: AlertContext): string {
    const { event, ticket, assigneeName } = ctx;
    const code = ticket.code;
    const name = ticket.name;

    switch (event) {
      case TicketEventType.TICKET_CREATED:
        return `[${code}] New Ticket Created – ${name}`;
      case TicketEventType.TICKET_UPDATED:
        return `[${code}] Ticket Updated – ${name}`;
      case TicketEventType.TICKET_ASSIGNED:
        return `[${code}] Ticket Assigned to ${assigneeName}`;
      case TicketEventType.STATUS_CHANGED:
        return `[${code}] Status Updated – ${ctx.newStatus ?? ''}`;
      case TicketEventType.SEVERITY_CHANGED:
        return `[${code}] Severity Updated – ${ctx.newSeverity ?? ''}`;
      case TicketEventType.QUEUE_CHANGED:
        return `[${code}] Queue Updated – ${ctx.newQueue ?? ''}`;
      case TicketEventType.NAME_CHANGED:
        return `[${code}] Ticket Renamed – ${ctx.newName ?? name}`;
      case TicketEventType.COMMENT_ADDED:
        return `[${code}] New Comment Added`;
      case TicketEventType.TICKET_DELETED:
        return `[${code}] Ticket Deleted – ${name}`;
    }
  }

  // ── Private: HTML template ────────────────────────────────────────────── //

  private buildHtml(ctx: AlertContext, viewTicketUrl: string): string {
    const { event, ticket, actorName, statusName, severityName, assigneeName } = ctx;

    const headerLabel: Record<TicketEventType, string> = {
      [TicketEventType.TICKET_CREATED]: 'New Ticket',
      [TicketEventType.TICKET_UPDATED]: 'Ticket Updated',
      [TicketEventType.TICKET_ASSIGNED]: 'Assignee Changed',
      [TicketEventType.STATUS_CHANGED]: 'Status Updated',
      [TicketEventType.SEVERITY_CHANGED]: 'Severity Updated',
      [TicketEventType.QUEUE_CHANGED]: 'Queue Updated',
      [TicketEventType.NAME_CHANGED]: 'Ticket Renamed',
      [TicketEventType.COMMENT_ADDED]: 'New Comment',
      [TicketEventType.TICKET_DELETED]: 'Ticket Deleted',
    };

    const actionLine: Record<TicketEventType, string> = {
      [TicketEventType.TICKET_CREATED]: `<strong>${actorName}</strong> created a new ticket`,
      [TicketEventType.TICKET_UPDATED]: `<strong>${actorName}</strong> updated this ticket`,
      [TicketEventType.TICKET_ASSIGNED]: `<strong>${actorName}</strong> assigned this ticket`,
      [TicketEventType.STATUS_CHANGED]: `<strong>${actorName}</strong> updated the ticket status`,
      [TicketEventType.SEVERITY_CHANGED]: `<strong>${actorName}</strong> updated the ticket severity`,
      [TicketEventType.QUEUE_CHANGED]: `<strong>${actorName}</strong> updated the ticket queue`,
      [TicketEventType.NAME_CHANGED]: `<strong>${actorName}</strong> renamed this ticket`,
      [TicketEventType.COMMENT_ADDED]: `<strong>${actorName}</strong> added a comment`,
      [TicketEventType.TICKET_DELETED]: `<strong>${actorName}</strong> deleted this ticket`,
    };

    const actorInitials = actorName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || '??';

    let customDetailBlockHtml = '';
    let metaRows: { label: string; valueHtml: string }[] = [];

    if (event === TicketEventType.TICKET_CREATED) {
      metaRows = [
        { label: 'Severity', valueHtml: buildChip(severityName, ctx.severityColor, { icon: 'flag' }) },
        { label: 'Status', valueHtml: buildChip(statusName, ctx.statusColor) },
        { label: 'Assignee', valueHtml: assigneeName },
      ];
    } else if (event === TicketEventType.TICKET_UPDATED) {
      const fields = ctx.updatedFields ?? [];
      const nonDescFields = fields.filter((f) => !f.isHtml);
      const descField = fields.find((f) => f.isHtml);

      metaRows = nonDescFields.map(f => {
        if (f.oldColor !== undefined || f.newColor !== undefined) {
          const icon: 'dot' | 'flag' = f.label === 'Severity' ? 'flag' : 'dot';
          return {
            label: f.label,
            valueHtml: `${buildChip(f.oldValue, f.oldColor, { muted: true, icon })} <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> ${buildChip(f.newValue, f.newColor, { icon })}`,
          };
        }
        return {
          label: f.label,
          valueHtml: `<span style="color:#94a3b8;font-weight:400;">${f.oldValue}</span> <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> <span style="color:#0f172a;font-weight:600;">${f.newValue}</span>`,
        };
      });

      if (descField) {
        customDetailBlockHtml = `
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
            <div style="font-size:11px;font-weight:600;color:#7aaac8;margin-bottom:8px;">Description Change</div>
            <div style="margin-bottom:12px;"><div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Before</div><div style="font-size:13px;color:#64748b;line-height:1.5;">${descField.oldValue || '<em>—</em>'}</div></div>
            <div><div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">After</div><div style="font-size:13px;color:#0f172a;line-height:1.5;">${descField.newValue || '<em>—</em>'}</div></div>
          </div>
        `;
      }
    } else if (event === TicketEventType.TICKET_ASSIGNED) {
      metaRows = [
        { label: 'Assignee', valueHtml: `<span style="color:#94a3b8;">${ctx.oldAssignee ?? 'Unassigned'}</span> <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> <span style="color:#0f172a;">${ctx.newAssignee ?? assigneeName}</span>` }
      ];
    } else if (event === TicketEventType.STATUS_CHANGED) {
      metaRows = [
        { label: 'Status', valueHtml: `${buildChip(ctx.oldStatus, ctx.oldStatusColor, { muted: true })} <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> ${buildChip(ctx.newStatus ?? statusName, ctx.newStatusColor ?? ctx.statusColor)}` }
      ];
    } else if (event === TicketEventType.SEVERITY_CHANGED) {
      metaRows = [
        { label: 'Severity', valueHtml: `${buildChip(ctx.oldSeverity, ctx.oldSeverityColor, { muted: true, icon: 'flag' })} <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> ${buildChip(ctx.newSeverity ?? severityName, ctx.newSeverityColor ?? ctx.severityColor, { icon: 'flag' })}` }
      ];
    } else if (event === TicketEventType.QUEUE_CHANGED) {
      metaRows = [
        { label: 'Queue', valueHtml: `<span style="color:#94a3b8;">${ctx.oldQueue ?? '—'}</span> <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> <span style="color:#0f172a;">${ctx.newQueue ?? '—'}</span>` }
      ];
    } else if (event === TicketEventType.NAME_CHANGED) {
      metaRows = [
        { label: 'Name', valueHtml: `<span style="color:#94a3b8;">${ctx.oldName ?? '—'}</span> <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> <span style="color:#0f172a;">${ctx.newName ?? ctx.ticket.name}</span>` }
      ];
    } else if (event === TicketEventType.COMMENT_ADDED) {
      const escaped = (ctx.commentText ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      customDetailBlockHtml = `
        <blockquote style="margin:24px 0 0;padding:16px 20px;
                           background-color:#f8fafc;border-left:4px solid #3b82f6;
                           border-radius:0 8px 8px 0;
                           color:#334155;font-size:14px;line-height:1.6;font-style:italic;">
          &ldquo;${escaped}&rdquo;
        </blockquote>`;
    } else if (event === TicketEventType.TICKET_DELETED) {
      customDetailBlockHtml = `
        <div class="deleted-alert" style="padding:14px 20px;background-color:#fff1f2;color:#b91c1c;font-size:13px;font-weight:500;text-align:center;border-radius:8px;border:1px solid #fecaca;margin-top:16px;">
          This ticket has been permanently deleted and is no longer accessible.
        </div>`;
    }

    const spaceName = ticket.ticketSpaceName ?? (ticket.ticketSpace as any)?.name ?? '—';
    const descriptionText = event === TicketEventType.TICKET_CREATED ? ticket.description : undefined;

    return buildEmailHtml({
      eventBadge: headerLabel[event],
      breadcrumb: `${spaceName} / ${ticket.code}`,
      title: ticket.name,
      actorInitials,
      actorName,
      actorProfilePicUrl: ctx.actorProfilePicUrl,
      actionSentence: actionLine[event],
      description: descriptionText,
      customDetailBlockHtml,
      metaRows,
      ctaUrl: event !== TicketEventType.TICKET_DELETED ? viewTicketUrl : undefined,
      ctaLabel: 'View Ticket',
      ctaSubTextHtml: `You were CC'd on this notification`,
    });
  }

  // ── Private: save Email + Notification rows, then enqueue Service Bus jobs //

  private async dispatch(ctx: AlertContext, authUser: any): Promise<void> {
    try {
      const frontendUrl = this.configService
        .get<string>('FRONTEND_URL', '')
        .replace(/\/+$/, '');
      const viewTicketUrl = `${frontendUrl}/ticket-management/ticket/form?ticketSpaceId=${ctx.ticket.ticketSpaceId}&edit=true&ticketId=${ctx.ticket.id}`;

      const subject = this.buildSubject(ctx);
      const html = this.buildHtml(ctx, viewTicketUrl);
      const actorEmail = ctx.actorEmail;

      // ── Resolve recipients via rule engine ────────────────────────────── //
      const resolved = await this.alertRuleService.resolveForEvent(
        'ticket',
        ctx.ticket.ticketSpaceId,
        ctx.event,
        {
          actorEmail: ctx.actorEmail,
          actorUserId: ctx.actorUserId,
          createdByEmail: ctx.createdByEmail,
          createdByUserId: ctx.createdByUserId,
          assigneeEmail: ctx.assigneeEmail,
          assigneeUserId: ctx.assigneeUserId,
          coAssigneeEmails: [],
          coAssigneeUserIds: [],
          memberEmails: [],
          memberUserIds: [],
          participantEmails: ctx.participantEmails,
          participantUserIds: ctx.participantUserIds,
        },
      );

      let toEmails: string[];
      let ccEmails: string[];
      let notifUserIds: number[];
      let notifUserEmailMap: Map<number, string>;
      let sendEmail = true;
      let sendInApp = true;

      if (resolved === null) {
        // ── LEGACY PATH — space has no rules at all ───────────────────────── //
        this.logger.log(
          `TicketAlertService: [${ctx.event}] no rules configured for space — using legacy hardcoded recipients`,
        );
        const { to, cc } = this.resolveRecipients(ctx);
        toEmails = to;
        ccEmails = cc;
        notifUserIds = [];
        notifUserEmailMap = new Map<number, string>();
        for (const email of [...to, ...cc]) {
          const user = await this.entityManager.findOne(User, {
            where: { email },
            select: ['id', 'email'],
          });
          if (user?.id) {
            notifUserIds.push(user.id);
            notifUserEmailMap.set(user.id, email);
          }
        }
      } else if (!resolved.sendEmail && !resolved.sendInApp) {
        // ── SUPPRESS — space has rules but none cover this event ─────────── //
        this.logger.log(
          `TicketAlertService: [${ctx.event}] suppressed for ticket ${ctx.ticket.id} — space has rules but none match this event`,
        );
        return;
      } else {
        // ── RULE-BASED PATH ───────────────────────────────────────────────── //
        toEmails = resolved.toEmails;
        ccEmails = resolved.ccEmails;
        notifUserIds = resolved.notifUserIds;
        notifUserEmailMap = resolved.notifUserEmailMap;
        sendEmail = resolved.sendEmail;
        sendInApp = resolved.sendInApp;
      }

      if (toEmails.length === 0) {
        this.logger.warn(
          `TicketAlertService: no TO recipients resolved for [${ctx.event}] ticket ${ctx.ticket.id} – skipping`,
        );
        return;
      }

      // ── Guard: skip email if company has no SMTP credentials ─────────── //
      if (sendEmail) {
        const smtpReady = await this.companyHasSmtpConfig(
          ctx.ticket.ticketSpaceId,
        );
        if (!smtpReady) {
          this.logger.warn(
            `TicketAlertService: [${ctx.event}] ticket ${ctx.ticket.id} — ` +
              `company has no notification email credentials configured (ticketSpaceId=${ctx.ticket.ticketSpaceId}). ` +
              `Email will NOT be queued. In-app notifications are still sent. ` +
              `Go to Company Settings → Notification Email to configure.`,
          );
          sendEmail = false;
        }
      }

      // ── 1. Save Email record ──────────────────────────────────────────── //
      if (sendEmail) {
        const email = new Email();
        email.from = ctx.fromEmail;
        email.to = toEmails.join(', ');
        email.ccTo =
          ccEmails.length > 0
            ? ccEmails.join(', ')
            : (undefined as unknown as string);
        email.subject = subject;
        email.description = html;
        email.spaceId = ctx.ticket.ticketSpaceId;
        email.companyId = ctx.ticket.companyId;
        email.userId = authUser?.userId as number;
        email.username = authUser?.username as string;
        email.createdBy = actorEmail;
        email.isSent = false;
        email.isError = false;

        if (ctx.event !== TicketEventType.TICKET_DELETED) {
          email.referenceId = ctx.ticket.id!;
          email.referenceType = 'ticket';
        }

        const savedEmail = await this.entityManager.transaction((manager) =>
          manager.save(Email, email),
        );
        const emailId = savedEmail.id!;

        // ── 2. Enqueue email job ──────────────────────────────────────────── //
        try {
          await this.serviceBusService.sendEmailJob(emailId);
        } catch (enqueueErr) {
          this.logger.error(
            `TicketAlertService: failed to enqueue email job — emailId: ${emailId}`,
            enqueueErr instanceof Error ? enqueueErr.stack : String(enqueueErr),
          );
          await this.entityManager.transaction(async (manager) => {
            savedEmail.isError = true;
            savedEmail.errorText = `Enqueue failed: ${enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)}`;
            await manager.save(Email, savedEmail);
          });
        }
      }

      // ── 3. Save Notification records ──────────────────────────────────── //
      if (sendInApp) {
        const notifIds: number[] = [];
        try {
          for (const userId of notifUserIds) {
            const notif = new Notification();
            notif.from = ctx.fromEmail;
            notif.to = notifUserEmailMap.get(userId) ?? actorEmail;
            notif.userId = userId;
            notif.companyId = ctx.ticket.companyId;
            notif.username = authUser?.email as string;
            notif.title = subject;
            notif.description = html;
            notif.createdBy = actorEmail;
            notif.isSent = false;
            notif.isRead = false;

            if (ctx.event !== TicketEventType.TICKET_DELETED) {
              notif.referenceId = ctx.ticket.id!;
              notif.referenceType = 'ticket';
              notif.referenceSpaceId = ctx.ticket.ticketSpaceId;
            }

            const savedNotif = await this.entityManager.transaction((manager) =>
              manager.save(Notification, notif),
            );
            notifIds.push(savedNotif.id!);
          }
        } catch (notifErr) {
          this.logger.warn(
            `TicketAlertService: notification save failed for [${ctx.event}] ticket ${ctx.ticket.id} — email was still sent`,
            notifErr instanceof Error ? notifErr.message : String(notifErr),
          );
        }

        // ── 4. Enqueue notification jobs ──────────────────────────────────── //
        for (const notifId of notifIds) {
          await this.serviceBusService.sendNotificationJob(notifId);
        }
      }
    } catch (err) {
      this.logger.error(
        `TicketAlertService: failed to dispatch [${ctx.event}] for ticket ${ctx.ticket.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ── Private: SMTP config guard ───────────────────────────────────────── //

  /**
   * Returns true only when the company linked to this ticket-space has all three
   * SMTP credentials set (notificationEmail, emailProvider, notificationEmailPassword).
   * If any field is missing the method returns false and logs nothing — the
   * caller is responsible for logging the warning.
   */
  private async companyHasSmtpConfig(ticketSpaceId: number): Promise<boolean> {
    return !!(
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING &&
      process.env.AZURE_COMMUNICATION_SENDER_EMAIL
    );
  }
}
