import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In, ILike, IsNull } from 'typeorm';
import { Task } from '../../task-management/task/task.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { TaskSpaceStatusConfig } from '../../task-management/task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../../task-management/task-space-severity-config/task-space-severity-config.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TmTaskService } from '../../task-management/task/task.service';
import { UpdateTaskDto } from '../../task-management/task/dto/task.dto';

export interface TaskMutationDraftResult {
  action: string;
  entityType: string;
  status: 'READY' | 'NEEDS_INPUT' | 'REFUSED';
  summary: string;
  drafts: any[];
  warnings: string[];
  options?: any[];
  allUnrecognized?: boolean;
}

export interface TaskCandidateResult {
  summary: string;
  candidateTasks: any[];
  options: any[];
}

@Injectable()
export class TaskMutationExecutorService {
  private readonly logger = new Logger(TaskMutationExecutorService.name);

  constructor(
    private readonly entityManager: EntityManager,
    private readonly tmTaskService: TmTaskService,
  ) {}

  /**
   * Loads target tasks by code, resolves requested field changes (status, assignee, severity, dates),
   * enforces strict space resource assignment and hierarchy immutability,
   * and prepares a diff draft for user confirmation.
   */
  async prepareTaskMutationDraft(
    mutationPayload: {
      action?: string;
      entityType?: string;
      targets: string[];
      changes: Record<string, any>;
      summary?: string;
      attemptedHierarchyChange?: boolean;
    },
    companyId: number,
    authUser?: any,
  ): Promise<TaskMutationDraftResult> {
    const rawTargets = mutationPayload.targets || [];
    const targets = rawTargets.map((t) => {
      const s = String(t).trim();
      return (s.includes(':') ? s.split(':')[0].trim() : s).toUpperCase();
    });
    const targetTitles = rawTargets.map((t) => String(t).trim().toLowerCase());
    const changes = mutationPayload.changes || {};
    const warnings: string[] = [];

    // Hierarchy Immutability Guard
    if (mutationPayload.attemptedHierarchyChange) {
      const refusalMsg = 'Hierarchy levels are permanently fixed upon task creation and cannot be modified.';
      return {
        action: 'UPDATE_TASK',
        entityType: 'task',
        status: 'REFUSED',
        summary: refusalMsg,
        drafts: [],
        warnings: [refusalMsg],
      };
    }

    if (targets.length === 0) {
      return {
        action: 'UPDATE_TASK',
        entityType: 'task',
        status: 'NEEDS_INPUT',
        summary: 'Which task would you like to update? Please specify a task code (e.g. PRJ-10).',
        drafts: [],
        warnings: [],
      };
    }

    // Load tasks by code or name with tenancy filtering
    const taskQuery = this.entityManager
      .createQueryBuilder(Task, 'task')
      .leftJoinAndSelect('task.taskSpace', 'taskSpace')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.parentTask', 'parentTask')
      .where('(UPPER(task.code) IN (:...targets) OR LOWER(task.name) IN (:...targetTitles))', {
        targets,
        targetTitles,
      });

    if (companyId && companyId !== 0) {
      taskQuery.andWhere('task.companyId = :companyId', { companyId });
    }

    let tasks = await taskQuery.getMany();

    if (tasks.length === 0) {
      return {
        action: 'UPDATE_TASK',
        entityType: 'task',
        status: 'NEEDS_INPUT',
        summary: `I could not find task(s) with code ${targets.join(', ')}. Please verify the task code.`,
        drafts: [],
        warnings: [`Task(s) ${targets.join(', ')} not found.`],
      };
    }

    // Detect if the user wants to update the children / subtasks of the target tasks
    const isChildrenScope =
      (mutationPayload as any).targetScope === 'children' ||
      (mutationPayload as any).includeChildren === true ||
      (mutationPayload as any).childrenOnly === true ||
      Boolean(
        mutationPayload.summary &&
          /\b(?:all\s+)?(?:child(?:ren)?|subtasks?|tasks?)\s+of\b/i.test(mutationPayload.summary),
      );

    if (isChildrenScope) {
      const parentIds = tasks.map((t) => t.id);
      const parentMap = new Map(tasks.map((t) => [t.id, t]));

      const childQuery = this.entityManager
        .createQueryBuilder(Task, 'task')
        .leftJoinAndSelect('task.taskSpace', 'taskSpace')
        .leftJoinAndSelect('task.assignee', 'assignee')
        .leftJoinAndSelect('task.parentTask', 'parentTask')
        .where('task.parentTaskId IN (:...parentIds)', { parentIds });

      if (companyId && companyId !== 0) {
        childQuery.andWhere('task.companyId = :companyId', { companyId });
      }

      const childTasks = await childQuery.getMany();

      if (childTasks.length === 0) {
        const parentCodes = tasks.map((t) => t.code).join(', ');
        return {
          action: 'UPDATE_TASK',
          entityType: 'task',
          status: 'NEEDS_INPUT',
          summary: `Project ${parentCodes} currently does not have any child tasks to update.`,
          drafts: [],
          warnings: [`No child tasks found under ${parentCodes}.`],
        };
      }

      childTasks.forEach((child) => {
        if (child.parentTaskId && parentMap.has(child.parentTaskId)) {
          child.parentTask = parentMap.get(child.parentTaskId)!;
        }
      });

      tasks = childTasks;
    }

    const preparedDrafts: any[] = [];

    for (const task of tasks) {
      const spaceId = task.taskSpaceId;

      // 1. Resolve Target Status
      let resolvedStatusId: number | undefined;
      let resolvedStatusName: string | undefined;
      let resolvedStatusColor: string | undefined;

      if (changes.statusName) {
        const statuses = await this.entityManager.find(TaskSpaceStatusConfig, {
          where: { taskSpaceId: spaceId },
        });
        const q = String(changes.statusName).trim().toLowerCase();
        const matched = statuses.find((s) => s.name?.toLowerCase() === q);
        if (matched) {
          resolvedStatusId = matched.id;
          resolvedStatusName = matched.name;
          resolvedStatusColor = matched.color;
        } else {
          warnings.push(`Status "${changes.statusName}" was not recognized in space "${task.taskSpaceName}".`);
        }
      }

      // 2. Resolve Target Severity
      let resolvedSeverityId: number | undefined;
      let resolvedSeverityName: string | undefined;
      let resolvedSeverityColor: string | undefined;

      if (changes.severityName) {
        const severities = await this.entityManager.find(TaskSpaceSeverityConfig, {
          where: { taskSpaceId: spaceId },
        });
        const q = String(changes.severityName).trim().toLowerCase();
        const matched = severities.find((s) => s.name?.toLowerCase() === q);
        if (matched) {
          resolvedSeverityId = matched.id;
          resolvedSeverityName = matched.name;
          resolvedSeverityColor = matched.color;
        } else {
          warnings.push(`Priority "${changes.severityName}" was not recognized in space "${task.taskSpaceName}".`);
        }
      }

      // 3. Strict Resource Scoping for Assignee
      let resolvedAssigneeId: number | undefined;
      let resolvedAssigneeName: string | undefined;
      let resolvedAssigneeEmail: string | undefined;
      let resolvedAssigneePic: string | undefined;

      if (changes.assigneeName) {
        const rawAssignee = String(changes.assigneeName).trim();
        const spaceWithRes = await this.entityManager.findOne(TaskSpace, {
          where: { id: spaceId },
          relations: ['resources'],
        });
        const assignedRes = spaceWithRes?.resources || [];

        let matchedRes: Resource | undefined;
        if (rawAssignee.toLowerCase() === 'me' && authUser) {
          matchedRes = assignedRes.find(
            (r) =>
              r.email?.toLowerCase() === authUser.email?.toLowerCase() ||
              `${r.first_name} ${r.last_name}`.toLowerCase() === authUser.name?.toLowerCase(),
          );
        } else {
          matchedRes = assignedRes.find((r) => {
            const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
            const q = rawAssignee.toLowerCase();
            return fullName.includes(q) || r.first_name?.toLowerCase() === q || r.last_name?.toLowerCase() === q;
          });
        }

        if (matchedRes) {
          resolvedAssigneeId = matchedRes.id;
          resolvedAssigneeName = `${matchedRes.first_name} ${matchedRes.last_name}`.trim();
          resolvedAssigneeEmail = matchedRes.email;
          resolvedAssigneePic = matchedRes.profile_pic;
        } else {
          warnings.push(
            `Resource "${rawAssignee}" is not assigned to space "${task.taskSpaceName}". Assignee remains unchanged.`,
          );
        }
      }

      // 4. Dates & Effort
      let resolvedDueDate = changes.dueDate;
      let resolvedStartDate = changes.startDate;
      let resolvedEffort = changes.estimateEffort ? parseFloat(String(changes.estimateEffort)) : undefined;

      preparedDrafts.push({
        id: task.id,
        code: task.code,
        name: task.name,
        taskSpaceId: task.taskSpaceId,
        taskSpaceName: task.taskSpaceName,
        taskSpacePrefix: task.taskSpacePrefix,
        parentTaskId: task.parentTaskId || task.parentTask?.id,
        parentTaskCode: task.parentTask?.code,
        parentTaskName: task.parentTask?.name,
        parentTaskStatusId: task.parentTask?.statusId,
        parentTaskStatusName: task.parentTask?.statusName,
        parentTaskStatusColor: task.parentTask?.statusColor,
        parentTaskSeverityId: task.parentTask?.severityId,
        parentTaskSeverityName: task.parentTask?.severityName,
        parentTaskSeverityColor: task.parentTask?.severityColor,
        parentTaskAssigneeId: task.parentTask?.assigneeId,
        parentTaskAssigneeName: task.parentTask?.assigneeName,
        parentTaskAssigneeProfilePicUrl: task.parentTask?.assigneeProfilePicUrl,
        parentTaskStartDate: task.parentTask?.startDate,
        parentTaskDueDate: task.parentTask?.dueDate,
        hierarchyLevelConfigId: task.hierarchyLevelConfigId,
        hierarchyLevelName: task.hierarchyLevelName,
        hierarchyLevelColor: task.hierarchyLevelColor,
        hierarchyLevelIcon: task.hierarchyLevelIcon,
        hierarchyLevelSequence: task.hierarchyLevelSequence,
        current: {
          statusId: task.statusId,
          statusName: task.statusName,
          statusColor: task.statusColor,
          severityId: task.severityId,
          severityName: task.severityName,
          severityColor: task.severityColor,
          assigneeId: task.assigneeId,
          assigneeName: task.assigneeName,
          startDate: task.startDate,
          dueDate: task.dueDate,
          estimateEffort: task.estimateEffort,
        },
        changes: {
          name: changes.name ?? task.name,
          description: changes.description ?? (task as any).description,
          statusId: resolvedStatusId ?? task.statusId,
          statusName: resolvedStatusName ?? task.statusName,
          statusColor: resolvedStatusColor ?? task.statusColor,
          severityId: resolvedSeverityId ?? task.severityId,
          severityName: resolvedSeverityName ?? task.severityName,
          severityColor: resolvedSeverityColor ?? task.severityColor,
          assigneeId: resolvedAssigneeId ?? task.assigneeId,
          assigneeName: resolvedAssigneeName ?? task.assigneeName,
          assigneeEmail: resolvedAssigneeEmail ?? task.assigneeEmail,
          assigneeProfilePicUrl: resolvedAssigneePic ?? task.assigneeProfilePicUrl,
          startDate: resolvedStartDate ?? task.startDate,
          dueDate: resolvedDueDate ?? task.dueDate,
          estimateEffort: resolvedEffort ?? task.estimateEffort,
        },
      });
    }

    const taskLabels = preparedDrafts.map((d) => `**${d.code}**`).join(', ');
    const displaySummary = isChildrenScope
      ? `I've prepared updates for all ${preparedDrafts.length} child tasks of ${targets.join(', ')} (${taskLabels}). Please review the proposed changes below.`
      : preparedDrafts.length === 1
        ? `I've prepared the update for ${taskLabels}. Please review the proposed changes below.`
        : `I've prepared updates for ${preparedDrafts.length} tasks (${taskLabels}). Please review the proposed changes below.`;

    return {
      action: 'UPDATE_TASK',
      entityType: 'task',
      status: 'READY',
      summary: displaySummary,
      drafts: preparedDrafts,
      warnings,
    };
  }

  /**
   * Resolves candidate tasks in a space when the user issues a query without explicit codes
   * (e.g. "Complete all open tasks in Website space").
   */
  async findCandidateTasks(
    mutationPayload: any,
    companyId: number,
    authUser: any,
    targetSpaceId?: number,
  ): Promise<TaskCandidateResult> {
    const filter = mutationPayload.filter || {};
    const qb = this.entityManager.createQueryBuilder(Task, 'task').leftJoinAndSelect('task.taskSpace', 'taskSpace');

    if (companyId && companyId !== 0) {
      qb.andWhere('task.companyId = :companyId', { companyId });
    }

    if (targetSpaceId && targetSpaceId !== 0) {
      qb.andWhere('task.taskSpaceId = :spaceId', { spaceId: targetSpaceId });
    }

    if (filter.status) {
      qb.andWhere('LOWER(task.statusName) = LOWER(:status)', { status: filter.status });
    }

    if (filter.assignee) {
      qb.andWhere('LOWER(task.assigneeName) LIKE LOWER(:assignee)', { assignee: `%${filter.assignee}%` });
    }

    const query = filter.query || filter.title || filter.name || filter.search;
    if (query) {
      const q = String(query).trim().toLowerCase();
      qb.andWhere('(LOWER(task.code) LIKE :q OR LOWER(task.name) LIKE :q)', { q: `%${q}%` });
    }

    const candidates = await qb.orderBy('task.id', 'DESC').take(10).getMany();

    const options = candidates.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      label: `${t.code}: ${t.name}`,
      actionText: `Update ${t.code}`,
    }));

    if (candidates.length > 1) {
      options.unshift({
        id: 0,
        code: 'ALL',
        name: `Move all (${candidates.length})`,
        label: `Move all matching (${candidates.length})`,
        actionText: `Update all ${candidates.length} tasks`,
      });
    }

    const summary =
      candidates.length > 0
        ? `Found ${candidates.length} matching task(s). Which one would you like to update?`
        : `No matching tasks found for the requested criteria.`;

    return {
      summary,
      candidateTasks: candidates,
      options,
    };
  }

  /**
   * Direct execution of task mutations via TmTaskService.
   */
  async executeTaskMutation(
    taskId: number,
    updateDto: UpdateTaskDto,
    companyId: number,
    authUser: any,
  ): Promise<Task> {
    return this.tmTaskService.update(taskId, updateDto, authUser, companyId);
  }
}

