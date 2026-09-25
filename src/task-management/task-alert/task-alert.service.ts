/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Task } from '../task/task.entity';
import { TaskSpace } from '../task-space/task-space.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TaskSpaceStatusConfig } from '../task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../task-space-severity-config/task-space-severity-config.entity';
import { User } from '../../user-management/user/user.entity';
import { Company } from '../../company-management/company/company.entity';
import { Email } from '../../alert/email/email.entity';
import { Notification } from '../../alert/notification/notification.entity';
import { ServiceBusService } from '../../common/azure/service-bus.service';
import { TaskEventType } from '../../common/enum/task-event.enum';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { AlertRuleService } from '../../alert/alert-rule/space-alert-rule.service';
import { buildEmailHtml, buildChip } from '../../common/email/email-template.helper';

// ─────────────────────────────────────────────────────────────────────────── //
//  Internal context – built once per dispatch, shared across private helpers
// ─────────────────────────────────────────────────────────────────────────── //
interface AlertContext {
  event: TaskEventType;
  task: Task;
  // Actor (who triggered the event)
  actorName: string;
  actorEmail: string;
  actorUserId: number | null;
  actorProfilePicUrl: string | null;
  // Task creator
  createdByEmail: string;
  createdByName: string;
  createdByUserId: number | null;
  // Current assignee (may be null)
  assigneeEmail: string | null;
  assigneeName: string;
  assigneeUserId: number | null;
  // Co-assignees
  coAssigneeEmails: string[];
  coAssigneeUserIds: number[];
  // Members (watchers / participants)
  memberEmails: string[];
  memberUserIds: number[];
  // Resolved display names
  statusName: string;
  severityName: string;
  // Space-configured colors for the current status/severity (hex, e.g. '#6366f1')
  statusColor: string | null;
  severityColor: string | null;
  // "From" email address used as the sender
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
  oldName?: string;
  newName?: string;
  oldAssignee?: string;
  newAssignee?: string;
  commentText?: string;
  // For TASK_UPDATED: resolved list of changed field old→new pairs
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
export class TaskAlertService {
  private readonly logger = new Logger(TaskAlertService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly serviceBusService: ServiceBusService,
    private readonly configService: ConfigService,
    private readonly alertRuleService: AlertRuleService,
  ) {}

  // ── Public entry points ──────────────────────────────────────────────── //

  async dispatchTaskCreated(taskId: number, authUser: any): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.TASK_CREATED,
    );
    if (!ctx) return;
    await this.dispatch(ctx, authUser);
  }

  async dispatchTaskUpdated(
    taskId: number,
    updateDto: Record<string, unknown>,
    oldSnapshot: Record<string, unknown>,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.TASK_UPDATED,
    );
    if (!ctx) return;

    // ── helpers ──────────────────────────────────────────────────────────── //
    const resolveStatusConfig = async (
      id: unknown,
    ): Promise<{ name: string; color: string | null }> => {
      if (!id) return { name: '—', color: null };
      const rec = await this.entityManager.findOne(TaskSpaceStatusConfig, {
        where: { id: Number(id) },
      });
      return { name: rec?.name ?? '—', color: rec?.color ?? null };
    };

    const resolveSeverityConfig = async (
      id: unknown,
    ): Promise<{ name: string; color: string | null }> => {
      if (!id) return { name: '—', color: null };
      const rec = await this.entityManager.findOne(TaskSpaceSeverityConfig, {
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
      updateDto.progressPercentage !== undefined &&
      Number(oldSnapshot.progressPercentage ?? 0) !==
        Number(updateDto.progressPercentage)
    )
      fields.push({
        label: 'Progress',
        oldValue: `${String(oldSnapshot.progressPercentage ?? 0)}%`,
        newValue: `${String(updateDto.progressPercentage)}%`,
      });

    if (
      updateDto.estimateEffort !== undefined &&
      Number(oldSnapshot.estimateEffort ?? 0) !==
        Number(updateDto.estimateEffort)
    )
      fields.push({
        label: 'Estimate Effort',
        oldValue:
          oldSnapshot.estimateEffort != null
            ? `${String(oldSnapshot.estimateEffort)}h`
            : '—',
        newValue: `${String(updateDto.estimateEffort)}h`,
      });

    if (
      updateDto.startDate !== undefined &&
      String(oldSnapshot.startDate ?? '') !== String(updateDto.startDate ?? '')
    )
      fields.push({
        label: 'Start Date',
        oldValue: String(oldSnapshot.startDate || '—'),
        newValue: String(updateDto.startDate || '—'),
      });

    if (
      updateDto.dueDate !== undefined &&
      String(oldSnapshot.dueDate ?? '') !== String(updateDto.dueDate ?? '')
    )
      fields.push({
        label: 'Due Date',
        oldValue: String(oldSnapshot.dueDate || '—'),
        newValue: String(updateDto.dueDate || '—'),
      });

    if (
      updateDto.actualStartDate !== undefined &&
      String(oldSnapshot.actualStartDate ?? '') !== String(updateDto.actualStartDate ?? '')
    )
      fields.push({
        label: 'Actual Start Date',
        oldValue: String(oldSnapshot.actualStartDate || '—'),
        newValue: String(updateDto.actualStartDate || '—'),
      });

    if (
      updateDto.actualEndDate !== undefined &&
      String(oldSnapshot.actualEndDate ?? '') !== String(updateDto.actualEndDate ?? '')
    )
      fields.push({
        label: 'Actual End Date',
        oldValue: String(oldSnapshot.actualEndDate || '—'),
        newValue: String(updateDto.actualEndDate || '—'),
      });

    if (
      updateDto.actualEffort !== undefined &&
      Number(oldSnapshot.actualEffort ?? 0) !== Number(updateDto.actualEffort)
    )
      fields.push({
        label: 'Actual Effort',
        oldValue:
          oldSnapshot.actualEffort != null
            ? `${String(oldSnapshot.actualEffort)}h`
            : '—',
        newValue: `${String(updateDto.actualEffort)}h`,
      });

    ctx.updatedFields = fields;
    await this.dispatch(ctx, authUser);
  }

  async dispatchTaskAssigned(
    taskId: number,
    oldAssigneeId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.TASK_ASSIGNED,
    );
    if (!ctx) return;
    this.logger.debug(`[Task ${taskId}] Assigned - Old: ${oldAssigneeId}, New: ${ctx.task.assigneeId}`);
    if (oldAssigneeId === ctx.task.assigneeId) return;

    let oldAssigneeName = 'Unassigned';
    if (oldAssigneeId) {
      const oldResource = await this.entityManager.findOne(Resource, {
        where: { id: oldAssigneeId },
        select: ['id', 'first_name', 'last_name', 'email'],
      });
      if (oldResource) {
        oldAssigneeName =
          `${oldResource.first_name ?? ''} ${oldResource.last_name ?? ''}`.trim() ||
          oldResource.email ||
          'Unassigned';
      }
    }

    ctx.oldAssignee = oldAssigneeName;
    ctx.newAssignee = ctx.assigneeName;
    await this.dispatch(ctx, authUser);
  }

  async dispatchStatusChanged(
    taskId: number,
    oldStatusId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.STATUS_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Task ${taskId}] Status - Old: ${oldStatusId}, New: ${ctx.task.statusId}`);
    if (oldStatusId === ctx.task.statusId) return;

    let oldStatusName = '—';
    let oldStatusColor: string | null = null;
    if (oldStatusId) {
      const oldStatus = await this.entityManager.findOne(TaskSpaceStatusConfig, {
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

  async dispatchSeverityChanged(
    taskId: number,
    oldSeverityId: number | null | undefined,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.SEVERITY_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Task ${taskId}] Severity - Old: ${oldSeverityId}, New: ${ctx.task.severityId}`);
    if (oldSeverityId === ctx.task.severityId) return;

    let oldSeverityName = '—';
    let oldSeverityColor: string | null = null;
    if (oldSeverityId) {
      const oldSeverity = await this.entityManager.findOne(TaskSpaceSeverityConfig, {
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

  async dispatchNameChanged(
    taskId: number,
    oldName: string,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.NAME_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Task ${taskId}] Name - Old: "${oldName}", New: "${ctx.task.name}"`);
    if (oldName === ctx.task.name) return;

    ctx.oldName = oldName;
    ctx.newName = ctx.task.name;
    await this.dispatch(ctx, authUser);
  }

  async dispatchProgressChanged(
    taskId: number,
    oldProgress: number,
    newProgress: number,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.PROGRESS_CHANGED,
    );
    if (!ctx) return;
    this.logger.debug(`[Task ${taskId}] Progress - Old: ${oldProgress}, New: ${newProgress}`);
    if (oldProgress === newProgress) return;

    ctx.updatedFields = [
      {
        label: 'Progress',
        oldValue: `${oldProgress}%`,
        newValue: `${newProgress}%`,
      },
    ];
    await this.dispatch(ctx, authUser);
  }

  async dispatchDatesChanged(
    taskId: number,
    oldStartDate: string | null,
    oldDueDate: string | null,
    newStartDate: string | null,
    newDueDate: string | null,
    authUser: any,
  ): Promise<void> {
    this.logger.debug(`[Task ${taskId}] Dates - Old: ${oldStartDate} to ${oldDueDate}, New: ${newStartDate} to ${newDueDate}`);
    if (oldStartDate === newStartDate && oldDueDate === newDueDate) return;

    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.DATES_CHANGED,
    );
    if (!ctx) return;

    ctx.updatedFields = [
      {
        label: 'Start Date',
        oldValue: oldStartDate ?? '—',
        newValue: newStartDate ?? '—',
      },
      {
        label: 'Due Date',
        oldValue: oldDueDate ?? '—',
        newValue: newDueDate ?? '—',
      },
    ];
    await this.dispatch(ctx, authUser);
  }

  async dispatchCommentAdded(
    taskId: number,
    commentText: string,
    authUser: any,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.COMMENT_ADDED,
    );
    if (!ctx) return;
    ctx.commentText = commentText;
    await this.dispatch(ctx, authUser);
  }

  /**
   * Pass `preloadedTask` (with taskSpace / status / severity / assignee /
   * coAssignees / members relations) to skip the DB fetch — required when the
   * task row has already been deleted before this method is called.
   */
  async dispatchTaskDeleted(
    taskId: number,
    authUser: any,
    preloadedTask?: Task,
  ): Promise<void> {
    const ctx = await this.loadContext(
      taskId,
      authUser,
      TaskEventType.TASK_DELETED,
      preloadedTask,
    );
    if (!ctx) return;
    await this.dispatch(ctx, authUser);
  }

  /**
   * Deletes all Email and Notification records created for a specific task
   * (identified by referenceId + referenceType = 'task').
   *
   * TASK_DELETED alert rows are intentionally excluded (referenceType = NULL)
   * so they remain as an audit trail even after the task is gone.
   *
   * Call this AFTER the task row is deleted from the DB.
   */
  async cleanupTaskAlerts(taskId: number): Promise<void> {
    try {
      await this.entityManager.transaction(async (manager) => {
        await manager.delete(Notification, {
          referenceId: taskId,
          referenceType: 'task',
        });
        await manager.delete(Email, {
          referenceId: taskId,
          referenceType: 'task',
        });
      });
      this.logger.log(
        `TaskAlertService: cleaned up alerts for deleted task ${taskId}`,
      );
    } catch (err) {
      this.logger.error(
        `TaskAlertService: failed to clean up alerts for task ${taskId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ── Private: load context from DB ────────────────────────────────────── //

  private async loadContext(
    taskId: number,
    authUser: any,
    event: TaskEventType,
    preloadedTask?: Task,
  ): Promise<AlertContext | null> {
    const task =
      preloadedTask ??
      (await this.entityManager.findOne(Task, {
        where: { id: taskId },
        relations: [
          'taskSpace',
          'taskSpace.division',
          'taskSpace.division.company',
          'status',
          'severity',
          'assignee',
          'coAssignees',
          'members',
        ],
      }));

    if (!task) {
      this.logger.warn(
        `TaskAlertService: task ${taskId} not found – skipping [${event}] alert`,
      );
      return null;
    }

    // Skip all notifications/emails for any change on a task whose current
    // status base is already Finished — except task creation and status changes
    // (status changes always notify regardless of the current status).
    if (
      event !== TaskEventType.TASK_CREATED &&
      event !== TaskEventType.STATUS_CHANGED &&
      task.status?.base === StatusBaseEnum.FINISHED
    ) {
      this.logger.log(
        `TaskAlertService: skipping [${event}] alert for task ${taskId} – task status base is already Finished`,
      );
      return null;
    }

    const actorEmail: string = (authUser?.email as string) ?? '';

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
    const createdByEmail = task.createdBy || actorEmail;
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

    // Assignee (Resource entity)
    const assigneeResource = task.assignee ?? null;
    const assigneeEmail = assigneeResource?.email || null;
    const assigneeName = assigneeResource
      ? `${assigneeResource.first_name ?? ''} ${assigneeResource.last_name ?? ''}`.trim() ||
        assigneeResource.email ||
        'Unassigned'
      : 'Unassigned';

    // Resolve assignee userId via User lookup by email
    let assigneeUserId: number | null = null;
    if (assigneeEmail) {
      const assigneeUser = await this.entityManager.findOne(User, {
        where: { email: assigneeEmail },
        select: ['id'],
      });
      assigneeUserId = assigneeUser?.id ?? null;
    }

    // Co-assignees
    const coAssignees = task.coAssignees ?? [];
    const coAssigneeEmails = coAssignees
      .map((r) => r.email)
      .filter((e): e is string => !!e);
    const coAssigneeUserIds: number[] = [];
    for (const email of coAssigneeEmails) {
      const u = await this.entityManager.findOne(User, {
        where: { email },
        select: ['id'],
      });
      if (u?.id) coAssigneeUserIds.push(u.id);
    }

    // Members (watchers)
    const members = task.members ?? [];
    const memberEmails = members
      .map((r) => r.email)
      .filter((e): e is string => !!e);
    const memberUserIds: number[] = [];
    for (const email of memberEmails) {
      const u = await this.entityManager.findOne(User, {
        where: { email },
        select: ['id'],
      });
      if (u?.id) memberUserIds.push(u.id);
    }

    return {
      event,
      task,
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
      coAssigneeEmails,
      coAssigneeUserIds,
      memberEmails,
      memberUserIds,
      statusName: task.status?.name ?? '—',
      severityName: task.severity?.name ?? '—',
      statusColor: task.status?.color ?? null,
      severityColor: task.severity?.color ?? null,
      fromEmail: actorEmail,
    };
  }

  // ── Private: recipient matrix ─────────────────────────────────────────── //

  private resolveRecipients(ctx: AlertContext): { to: string[]; cc: string[] } {
    const {
      event,
      assigneeEmail,
      createdByEmail,
      coAssigneeEmails,
      memberEmails,
      actorEmail,
    } = ctx;

    const clean = (set: Set<string>): string[] =>
      [...set].filter((e): e is string => !!e);

    const allParticipants = [...coAssigneeEmails, ...memberEmails];

    switch (event) {
      // TASK_CREATED / TASK_UPDATED
      // TO: assignee  |  CC: createdBy + coAssignees + members
      case TaskEventType.TASK_CREATED:
      case TaskEventType.TASK_UPDATED: {
        const to = new Set<string>();
        if (assigneeEmail) to.add(assigneeEmail);
        if (to.size === 0) to.add(createdByEmail || actorEmail);
        const cc = new Set<string>(
          [createdByEmail, ...allParticipants].filter((e) => !!e && !to.has(e)),
        );
        return { to: clean(to), cc: clean(cc) };
      }

      // TASK_ASSIGNED
      // TO: new assignee  |  CC: actor + createdBy + coAssignees + members
      case TaskEventType.TASK_ASSIGNED: {
        const to = new Set<string>();
        if (assigneeEmail) to.add(assigneeEmail);
        if (to.size === 0) to.add(createdByEmail);
        if (to.size === 0) to.add(actorEmail);
        const cc = new Set<string>(
          [actorEmail, createdByEmail, ...allParticipants].filter(
            (e) => !!e && !to.has(e),
          ),
        );
        return { to: clean(to), cc: clean(cc) };
      }

      // STATUS / SEVERITY / NAME / COMMENT / PROGRESS / DATES changed
      // TO: assignee + createdBy  |  CC: coAssignees + members
      case TaskEventType.STATUS_CHANGED:
      case TaskEventType.SEVERITY_CHANGED:
      case TaskEventType.NAME_CHANGED:
      case TaskEventType.COMMENT_ADDED:
      case TaskEventType.PROGRESS_CHANGED:
      case TaskEventType.DATES_CHANGED: {
        const to = new Set<string>();
        if (assigneeEmail) to.add(assigneeEmail);
        if (createdByEmail) to.add(createdByEmail);
        if (to.size === 0) to.add(actorEmail);
        const cc = new Set<string>(
          allParticipants.filter((e) => !!e && !to.has(e)),
        );
        return { to: clean(to), cc: clean(cc) };
      }

      // TASK_DELETED
      // TO: createdBy  |  CC: actor + assignee + coAssignees + members
      case TaskEventType.TASK_DELETED: {
        const to = new Set<string>();
        if (createdByEmail) to.add(createdByEmail);
        if (to.size === 0) to.add(actorEmail);
        const cc = new Set<string>(
          [actorEmail, assigneeEmail, ...allParticipants].filter(
            (e): e is string => !!e && !to.has(e),
          ),
        );
        return { to: clean(to), cc: clean(cc) };
      }
    }
  }

  // ── Private: subject line ─────────────────────────────────────────────── //

  private buildSubject(ctx: AlertContext): string {
    const { event, task, assigneeName } = ctx;
    const code = task.code ?? `#${String(task.id)}`;
    const name = task.name;

    switch (event) {
      case TaskEventType.TASK_CREATED:
        return `[${code}] New Task Created – ${name}`;
      case TaskEventType.TASK_UPDATED:
        return `[${code}] Task Updated – ${name}`;
      case TaskEventType.TASK_ASSIGNED:
        return `[${code}] Task Assigned to ${assigneeName}`;
      case TaskEventType.STATUS_CHANGED:
        return `[${code}] Status Updated – ${ctx.newStatus ?? ''}`;
      case TaskEventType.SEVERITY_CHANGED:
        return `[${code}] Severity Updated – ${ctx.newSeverity ?? ''}`;
      case TaskEventType.NAME_CHANGED:
        return `[${code}] Task Renamed – ${ctx.newName ?? name}`;
      case TaskEventType.COMMENT_ADDED:
        return `[${code}] New Comment Added`;
      case TaskEventType.PROGRESS_CHANGED:
        return `[${code}] Progress Updated – ${ctx.updatedFields?.[0]?.newValue ?? ''}`;
      case TaskEventType.DATES_CHANGED:
        return `[${code}] Dates Updated – ${name}`;
      case TaskEventType.TASK_DELETED:
        return `[${code}] Task Deleted – ${name}`;
    }
  }

  // ── Private: HTML email template ──────────────────────────────────────── //

  private buildHtml(ctx: AlertContext, viewTaskUrl: string): string {
    const { event, task, actorName, statusName, severityName, assigneeName } = ctx;

    const headerLabel: Record<TaskEventType, string> = {
      [TaskEventType.TASK_CREATED]: 'New Task',
      [TaskEventType.TASK_UPDATED]: 'Task Updated',
      [TaskEventType.TASK_ASSIGNED]: 'Assignee Changed',
      [TaskEventType.STATUS_CHANGED]: 'Status Updated',
      [TaskEventType.SEVERITY_CHANGED]: 'Severity Updated',
      [TaskEventType.NAME_CHANGED]: 'Task Renamed',
      [TaskEventType.COMMENT_ADDED]: 'New Comment',
      [TaskEventType.PROGRESS_CHANGED]: 'Progress Updated',
      [TaskEventType.DATES_CHANGED]: 'Dates Updated',
      [TaskEventType.TASK_DELETED]: 'Task Deleted',
    };

    const actionLine: Record<TaskEventType, string> = {
      [TaskEventType.TASK_CREATED]: `<strong>${actorName}</strong> created a new task`,
      [TaskEventType.TASK_UPDATED]: `<strong>${actorName}</strong> updated this task`,
      [TaskEventType.TASK_ASSIGNED]: `<strong>${actorName}</strong> assigned this task`,
      [TaskEventType.STATUS_CHANGED]: `<strong>${actorName}</strong> updated the task status`,
      [TaskEventType.SEVERITY_CHANGED]: `<strong>${actorName}</strong> updated the task severity`,
      [TaskEventType.NAME_CHANGED]: `<strong>${actorName}</strong> renamed this task`,
      [TaskEventType.COMMENT_ADDED]: `<strong>${actorName}</strong> added a comment`,
      [TaskEventType.PROGRESS_CHANGED]: `<strong>${actorName}</strong> updated the task progress`,
      [TaskEventType.DATES_CHANGED]: `<strong>${actorName}</strong> updated the task dates`,
      [TaskEventType.TASK_DELETED]: `<strong>${actorName}</strong> deleted this task`,
    };

    const actorInitials = actorName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || '??';

    let customDetailBlockHtml = '';
    let metaRows: { label: string; valueHtml: string }[] = [];

    if (event === TaskEventType.TASK_CREATED) {
      metaRows = [
        { label: 'Severity', valueHtml: buildChip(severityName, ctx.severityColor, { icon: 'flag' }) },
        { label: 'Status', valueHtml: buildChip(statusName, ctx.statusColor) },
        { label: 'Assignee', valueHtml: assigneeName },
      ];
    } else if (
      event === TaskEventType.TASK_UPDATED ||
      event === TaskEventType.PROGRESS_CHANGED ||
      event === TaskEventType.DATES_CHANGED
    ) {
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
    } else if (event === TaskEventType.TASK_ASSIGNED) {
      metaRows = [
        { label: 'Assignee', valueHtml: `<span style="color:#94a3b8;">${ctx.oldAssignee ?? 'Unassigned'}</span> <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> <span style="color:#0f172a;">${ctx.newAssignee ?? assigneeName}</span>` }
      ];
    } else if (event === TaskEventType.STATUS_CHANGED) {
      metaRows = [
        { label: 'Status', valueHtml: `${buildChip(ctx.oldStatus, ctx.oldStatusColor, { muted: true })} <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> ${buildChip(ctx.newStatus ?? statusName, ctx.newStatusColor ?? ctx.statusColor)}` }
      ];
    } else if (event === TaskEventType.SEVERITY_CHANGED) {
      metaRows = [
        { label: 'Severity', valueHtml: `${buildChip(ctx.oldSeverity, ctx.oldSeverityColor, { muted: true, icon: 'flag' })} <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> ${buildChip(ctx.newSeverity ?? severityName, ctx.newSeverityColor ?? ctx.severityColor, { icon: 'flag' })}` }
      ];
    } else if (event === TaskEventType.NAME_CHANGED) {
      metaRows = [
        { label: 'Name', valueHtml: `<span style="color:#94a3b8;">${ctx.oldName ?? '—'}</span> <span style="color:#94a3b8;">&nbsp;→&nbsp;</span> <span style="color:#0f172a;">${ctx.newName ?? ctx.task.name}</span>` }
      ];
    } else if (event === TaskEventType.COMMENT_ADDED) {
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
    } else if (event === TaskEventType.TASK_DELETED) {
      customDetailBlockHtml = `
        <div class="deleted-alert" style="padding:14px 20px;background-color:#fff1f2;color:#b91c1c;font-size:13px;font-weight:500;text-align:center;border-radius:8px;border:1px solid #fecaca;margin-top:16px;">
          This task has been permanently deleted and is no longer accessible.
        </div>`;
    }

    const spaceName = task.taskSpace?.name ?? '—';
    const descriptionText = event === TaskEventType.TASK_CREATED ? task.description : undefined;
    const taskCode = task.code ?? `#${task.id}`;

    return buildEmailHtml({
      eventBadge: headerLabel[event],
      breadcrumb: `${spaceName} / ${taskCode}`,
      title: task.name,
      actorInitials,
      actorName,
      actorProfilePicUrl: ctx.actorProfilePicUrl,
      actionSentence: actionLine[event],
      description: descriptionText,
      customDetailBlockHtml,
      metaRows,
      ctaUrl: event !== TaskEventType.TASK_DELETED ? viewTaskUrl : undefined,
      ctaLabel: 'View Task',
      ctaSubTextHtml: `You were CC'd on this notification`,
    });
  }

  // ── Private: save Email + Notification rows, then enqueue Service Bus jobs //

  private async dispatch(ctx: AlertContext, authUser: any): Promise<void> {
    try {
      const frontendUrl = this.configService
        .get<string>('FRONTEND_URL', '')
        .replace(/\/+$/, '');
      const viewTaskUrl = `${frontendUrl}/task-management/task/form?id=${ctx.task.id}`;

      const subject = this.buildSubject(ctx);
      const html = this.buildHtml(ctx, viewTaskUrl);
      const actorEmail = ctx.actorEmail;

      // ── Resolve recipients via rule engine ────────────────────────────── //
      const resolved = await this.alertRuleService.resolveForEvent(
        'task',
        ctx.task.taskSpaceId,
        ctx.event,
        {
          actorEmail: ctx.actorEmail,
          actorUserId: ctx.actorUserId,
          createdByEmail: ctx.createdByEmail,
          createdByUserId: ctx.createdByUserId,
          assigneeEmail: ctx.assigneeEmail,
          assigneeUserId: ctx.assigneeUserId,
          coAssigneeEmails: ctx.coAssigneeEmails,
          coAssigneeUserIds: ctx.coAssigneeUserIds,
          memberEmails: ctx.memberEmails,
          memberUserIds: ctx.memberUserIds,
          participantEmails: [],
          participantUserIds: [],
        },
      );

      let toEmails: string[];
      let ccEmails: string[];
      let notifUserIds: number[];
      let notifUserEmailMap: Map<number, string>;
      let sendEmail = true;
      let sendInApp = true;

      if (resolved === null) {
        // ─��� LEGACY PATH — space has no rules at all ───────────────────────── //
        this.logger.log(
          `TaskAlertService: [${ctx.event}] no rules configured for space — using legacy hardcoded recipients`,
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
          `TaskAlertService: [${ctx.event}] suppressed for task ${ctx.task.id} — space has rules but none match this event`,
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
          `TaskAlertService: no TO recipients resolved for [${ctx.event}] task ${ctx.task.id} – skipping`,
        );
        return;
      }

      // ── Guard: skip email if company has no SMTP credentials ─────────── //
      if (sendEmail) {
        const smtpReady = await this.companyHasSmtpConfig(ctx.task.taskSpaceId);
        if (!smtpReady) {
          this.logger.warn(
            `TaskAlertService: [${ctx.event}] task ${ctx.task.id} — ` +
              `company has no notification email credentials configured (taskSpaceId=${ctx.task.taskSpaceId}). ` +
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
        email.spaceId = ctx.task.taskSpaceId;
        email.companyId = ctx.task.companyId;
        email.userId = authUser?.userId as number;
        email.username = authUser?.username as string;
        email.createdBy = actorEmail;
        email.isSent = false;
        email.isError = false;

        if (ctx.event !== TaskEventType.TASK_DELETED) {
          email.referenceId = ctx.task.id!;
          email.referenceType = 'task';
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
            `TaskAlertService: failed to enqueue email job — emailId: ${emailId}`,
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
            notif.companyId = ctx.task.companyId;
            notif.username = authUser?.email as string;
            notif.title = subject;
            notif.description = html;
            notif.createdBy = actorEmail;
            notif.isSent = false;
            notif.isRead = false;
            notif.referenceSpaceId = ctx.task.taskSpaceId;

            if (ctx.event !== TaskEventType.TASK_DELETED) {
              notif.referenceId = ctx.task.id!;
              notif.referenceType = 'task';
            }

            const savedNotif = await this.entityManager.transaction((manager) =>
              manager.save(Notification, notif),
            );
            notifIds.push(savedNotif.id!);
          }
        } catch (notifErr) {
          this.logger.warn(
            `TaskAlertService: notification save failed for [${ctx.event}] task ${ctx.task.id} — email was still sent`,
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
        `TaskAlertService: failed to dispatch [${ctx.event}] for task ${ctx.task.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ── Private: SMTP config guard ───────────────────────────────────────── //

  /**
   * Returns true only when the company linked to this task-space has all three
   * SMTP credentials set (notificationEmail, emailProvider, notificationEmailPassword).
   * If any field is missing the method returns false and logs nothing — the
   * caller is responsible for logging the warning.
   */
  private async companyHasSmtpConfig(taskSpaceId: number): Promise<boolean> {
    return !!(
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING &&
      process.env.AZURE_COMMUNICATION_SENDER_EMAIL
    );
  }
}
