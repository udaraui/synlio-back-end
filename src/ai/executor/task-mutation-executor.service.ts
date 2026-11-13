import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In, ILike, IsNull } from 'typeorm';
import { Task } from '../../task-management/task/task.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { TaskSpaceStatusConfig } from '../../task-management/task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../../task-management/task-space-severity-config/task-space-severity-config.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TmTaskService } from '../../task-management/task/task.service';
import { UpdateTaskDto } from '../../task-management/task/dto/task.dto';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';

export function resolveSpaceStatus(
  statuses: Array<{ id?: number | string; name?: string; color?: string; base?: StatusBaseEnum; isPrimaryBase?: boolean }>,
  requestedStatus: string,
): { id: number; name: string; color: string } | null {
  if (!requestedStatus || !statuses || statuses.length === 0) return null;
  const q = String(requestedStatus).trim().toLowerCase();

  // Tier 1: Exact Name Match
  const exact = statuses.find((s) => s.name?.trim().toLowerCase() === q);
  if (exact && exact.id !== undefined) return { id: Number(exact.id), name: exact.name || '', color: exact.color || '#6366f1' };

  // Tier 1b: Substring Match
  const sub = statuses.find(
    (s) => s.name && (s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())),
  );
  if (sub && sub.id !== undefined) return { id: Number(sub.id), name: sub.name || '', color: sub.color || '#6366f1' };

  // Tier 2: Status Base Semantic Mapping
  let targetBase: StatusBaseEnum | null = null;
  if (/^(done|complete|completed|finish|finished|resolved|resolve|closed|close)$/i.test(q)) {
    targetBase = StatusBaseEnum.FINISHED;
  } else if (/^(in\s*progress|inprogress|processing|in\s*review|inreview|ongoing|underway)$/i.test(q)) {
    targetBase = StatusBaseEnum.PROCESSING;
  } else if (/^(to\s*do|todo|to\s*start|tostart|open|new|backlog|reopen)$/i.test(q)) {
    targetBase = StatusBaseEnum.TOSTART;
  }

  if (targetBase) {
    const baseMatches = statuses.filter((s) => s.base === targetBase);
    if (baseMatches.length > 0) {
      const semanticMatch = baseMatches.find(
        (s) => s.name && (s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())),
      );
      const primary = baseMatches.find((s) => s.isPrimaryBase);
      const chosen = semanticMatch || primary || baseMatches[0];
      if (chosen && chosen.id !== undefined) {
        return { id: Number(chosen.id), name: chosen.name || '', color: chosen.color || '#6366f1' };
      }
    }
  }

  return null;
}

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
        const matched = resolveSpaceStatus(statuses, changes.statusName);
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
          relations: ['resources', 'owners'],
        });
        const assignedRes: Resource[] = [...(spaceWithRes?.resources || [])];

        if (spaceWithRes?.owners && spaceWithRes.owners.length > 0) {
          const ownerEmails = spaceWithRes.owners.map((o) => o.email).filter(Boolean);
          if (ownerEmails.length > 0) {
            const ownerResources = await this.entityManager
              .createQueryBuilder(Resource, 'resource')
              .where('LOWER(resource.email) IN (:...ownerEmails)', {
                ownerEmails: ownerEmails.map((e) => e.toLowerCase()),
              })
              .getMany();

            for (const or of ownerResources) {
              if (!assignedRes.some((ar) => ar.id === or.id)) {
                assignedRes.push(or);
              }
            }
          }
        }

        const cleanStr = (s?: string) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const q = cleanStr(rawAssignee);
        let matchedRes: Resource | undefined;

        if (q === 'me' && authUser) {
          const authEmail = cleanStr(authUser.email);
          const authName = cleanStr(authUser.name);
          matchedRes = assignedRes.find((r) => {
            const rEmail = cleanStr(r.email);
            const rFull = cleanStr(`${r.first_name || ''} ${r.last_name || ''}`);
            return (authEmail && rEmail === authEmail) || (authName && rFull === authName);
          });
        } else {
          matchedRes = assignedRes.find((r) => {
            const fullName = cleanStr(`${r.first_name || ''} ${r.last_name || ''}`);
            const fName = cleanStr(r.first_name);
            const lName = cleanStr(r.last_name);
            const email = cleanStr(r.email);
            return (
              fullName === q ||
              fullName.includes(q) ||
              q.includes(fullName) ||
              fName === q ||
              lName === q ||
              (email && email === q)
            );
          });

          if (!matchedRes) {
            matchedRes = assignedRes.find((r) => {
              const fName = cleanStr(r.first_name);
              const lName = cleanStr(r.last_name);
              if (fName.length >= 3 && q.length >= 3) {
                if (fName.startsWith(q) || q.startsWith(fName)) return true;
                let diff = 0;
                const minLen = Math.min(fName.length, q.length);
                for (let i = 0; i < minLen; i++) {
                  if (fName[i] !== q[i]) diff++;
                }
                if (diff <= 1 && Math.abs(fName.length - q.length) <= 1) return true;
              }
              if (lName.length >= 3 && q.length >= 3) {
                if (lName.startsWith(q) || q.startsWith(lName)) return true;
              }
              return false;
            });
          }
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
      const statusTerm = String(filter.status).trim().toLowerCase();
      let baseTerm: string | null = null;
      if (/^(open|todo|to\s*do|to\s*start|new|backlog)$/i.test(statusTerm)) baseTerm = StatusBaseEnum.TOSTART;
      else if (/^(in\s*progress|ongoing|processing|in\s*review)$/i.test(statusTerm)) baseTerm = StatusBaseEnum.PROCESSING;
      else if (/^(done|closed|resolved|completed)$/i.test(statusTerm)) baseTerm = StatusBaseEnum.FINISHED;

      if (baseTerm) {
        qb.andWhere('(LOWER(task.statusName) = :status OR task.statusBase = :baseTerm)', {
          status: statusTerm,
          baseTerm,
        });
      } else {
        qb.andWhere('LOWER(task.statusName) = :status', { status: statusTerm });
      }
    }

    if (filter.assignee) {
      qb.andWhere('LOWER(task.assigneeName) LIKE LOWER(:assignee)', { assignee: `%${filter.assignee}%` });
    }

    // Filter by severity/priority if requested (e.g. "all low-priority tasks")
    // The filter.severity is populated from the user's source-filter criterion (not the target change value)
    const severityFilter = filter.severity || filter.severityName || filter.priority;
    if (severityFilter) {
      const sev = String(severityFilter).trim().toLowerCase();
      qb.leftJoin('task.severity', 'taskSeverity');
      qb.andWhere('(LOWER(task.severityName) LIKE :severity OR LOWER(taskSeverity.name) LIKE :severity)', { severity: `%${sev}%` });
    }

    const query = filter.query || filter.title || filter.name || filter.search;
    if (query) {
      const q = String(query).trim().toLowerCase();
      // Search across ALL hierarchy levels (not just root tasks) for title + code
      qb.andWhere('(LOWER(task.code) LIKE :q OR LOWER(task.name) LIKE :q)', { q: `%${q}%` });
    }

    const candidates = await qb.orderBy('task.id', 'DESC').take(10).getMany();

    // Confidence guard: when searching by title, filter out candidates with low title similarity
    // to avoid returning completely unrelated tasks (e.g. "Untitled Task" for "Ticker implementation")
    let filteredCandidates = candidates;
    if (query && candidates.length > 0) {
      const q = String(query).trim().toLowerCase();
      const scored = candidates.map((t) => {
        const name = (t.name || '').toLowerCase();
        const code = (t.code || '').toLowerCase();
        // Simple token overlap score: ratio of query words found in name
        const queryTokens = q.split(/\s+/).filter((w) => w.length > 2);
        const nameTokens = name.split(/\s+/);
        const overlap = queryTokens.filter((w) => nameTokens.some((n) => n.includes(w) || w.includes(n))).length;
        const score = queryTokens.length > 0 ? overlap / queryTokens.length : 0;
        const exactCodeMatch = code === q || code.includes(q);
        return { task: t, score, exactCodeMatch };
      });

      // Keep candidates with meaningful title overlap OR exact code match
      // If NO candidate passes the threshold, return all (to avoid empty result)
      const goodMatches = scored.filter((s) => s.exactCodeMatch || s.score >= 0.4);
      if (goodMatches.length > 0) {
        filteredCandidates = goodMatches.map((s) => s.task);
      }
      // Sort best matches first
      filteredCandidates = filteredCandidates.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aScore = scored.find((s) => s.task.id === a.id)?.score ?? 0;
        const bScore = scored.find((s) => s.task.id === b.id)?.score ?? 0;
        return bScore - aScore;
      });
    }

    const options = filteredCandidates.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      label: `${t.code}: ${t.name}`,
      actionText: `Update ${t.code}`,
    }));

    if (filteredCandidates.length > 1) {
      options.unshift({
        id: 0,
        code: 'ALL',
        name: `Move all (${filteredCandidates.length})`,
        label: `Move all matching (${filteredCandidates.length})`,
        actionText: `Update all ${filteredCandidates.length} tasks`,
      });
    }

    const summary =
      filteredCandidates.length > 0
        ? `Found ${filteredCandidates.length} matching task(s). Which one would you like to update?`
        : `No matching tasks found for the requested criteria.`;

    return {
      summary,
      candidateTasks: filteredCandidates,
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

