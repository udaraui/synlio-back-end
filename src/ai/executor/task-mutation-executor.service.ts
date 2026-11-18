import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In, ILike, IsNull, Brackets } from 'typeorm';
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
      filter?: Record<string, any>;
      explicitTargets?: boolean;
    },
    companyId: number,
    authUser?: any,
  ): Promise<TaskMutationDraftResult> {
    const rawTargets = mutationPayload.targets || [];
    const targets: string[] = [];
    const partialTargets: string[] = [];
    rawTargets.forEach((t) => {
      let s = String(t).trim();
      if (s.includes(':')) s = s.split(':')[0].trim();
      s = s.replace(/^-+/, '').toUpperCase();
      if (s) {
        targets.push(s);
        partialTargets.push(`%-${s}`);
      }
    });
    const targetTitles = rawTargets.map((t) => String(t).trim().toLowerCase());
    const changes = mutationPayload.changes || {};
    const warnings: string[] = [];
    const filterSeverity = String(
      mutationPayload.filter?.severity ||
      mutationPayload.filter?.severityName ||
      mutationPayload.filter?.priority ||
      '',
    ).trim().toLowerCase();

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

    // Load tasks by code or name with tenancy filtering (supports full or partial codes e.g. -E2-S2)
    const taskQuery = this.entityManager
      .createQueryBuilder(Task, 'task')
      .leftJoinAndSelect('task.taskSpace', 'taskSpace')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.severity', 'severity')
      .leftJoinAndSelect('task.parentTask', 'parentTask')
      .leftJoinAndSelect('parentTask.hierarchyLevelConfig', 'parentHierarchyLevelConfig')
      .leftJoinAndSelect('task.hierarchyLevelConfig', 'hierarchyLevelConfig')
      .where(
        '(UPPER(task.code) IN (:...targets) OR LOWER(task.name) IN (:...targetTitles) OR UPPER(task.code) LIKE ANY(ARRAY[:...partialTargets]))',
        {
          targets: targets.length > 0 ? targets : [''],
          targetTitles: targetTitles.length > 0 ? targetTitles : [''],
          partialTargets: partialTargets.length > 0 ? partialTargets : ['%__NOMATCH__'],
        },
      );

    if (companyId && companyId !== 0) {
      taskQuery.andWhere('task.companyId = :companyId', { companyId });
    }

    let tasks = await taskQuery.getMany();
    if (!mutationPayload.explicitTargets && filterSeverity) {
      tasks = tasks.filter((t: any) => {
        const actualSev = String(t.severity?.name || t.severityName || '').trim().toLowerCase();
        return Boolean(actualSev && actualSev.includes(filterSeverity));
      });
    }

    if (tasks.length === 0) {
      return {
        action: 'UPDATE_TASK',
        entityType: 'task',
        status: 'NEEDS_INPUT',
        summary: !mutationPayload.explicitTargets && filterSeverity
          ? `There are no ${filterSeverity}-priority tasks matching your criteria in this space.`
          : `I could not find task(s) with code ${targets.join(', ')}. Please verify the task code.`,
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
    const statusRefusedCodes: string[] = [];
    const dateRefusedCodes: string[] = [];

    // Batch-check child tasks & child scheduled dates for rollup protection
    const taskIds = tasks.map((t) => t.id);
    const childStatsByParentId = new Map<number, { hasChildren: boolean; hasChildrenWithDates: boolean }>();
    if (taskIds.length > 0) {
      const allChildren = await this.entityManager
        .createQueryBuilder(Task, 'child')
        .select(['child.id', 'child.parentTaskId', 'child.startDate', 'child.dueDate'])
        .where('child.parentTaskId IN (:...taskIds)', { taskIds })
        .getMany();

      for (const child of allChildren) {
        const pid = Number(child.parentTaskId);
        if (!pid) continue;
        const existing = childStatsByParentId.get(pid) || { hasChildren: false, hasChildrenWithDates: false };
        existing.hasChildren = true;
        const hasStart = Boolean(
          child.startDate && String(child.startDate).trim() !== '' && !isNaN(new Date(child.startDate).getTime()),
        );
        const hasDue = Boolean(
          child.dueDate && String(child.dueDate).trim() !== '' && !isNaN(new Date(child.dueDate).getTime()),
        );
        if (hasStart || hasDue) {
          existing.hasChildrenWithDates = true;
        }
        childStatsByParentId.set(pid, existing);
      }
    }

    for (const task of tasks) {
      const spaceId = task.taskSpaceId;
      const childStats = childStatsByParentId.get(Number(task.id)) || { hasChildren: false, hasChildrenWithDates: false };

      // 1. Resolve Target Status (with Child Rollup Protection)
      let resolvedStatusId: number | undefined;
      let resolvedStatusName: string | undefined;
      let resolvedStatusColor: string | undefined;
      let statusChangeRefusedReason: string | null = null;

      if (changes.statusName) {
        if (childStats.hasChildren) {
          statusChangeRefusedReason = `Cannot change status for **${task.code}** because it has child tasks and its status rolls up automatically from its children.`;
          statusRefusedCodes.push(task.code);
        } else {
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

      // 4. Dates & Effort (with Child Rollup Protection)
      let resolvedDueDate = changes.dueDate;
      let resolvedStartDate = changes.startDate;
      let resolvedEffort = changes.estimateEffort ? parseFloat(String(changes.estimateEffort)) : undefined;

      let dateChangeRefusedReason: string | null = null;
      const hasDateChangeRequested = Boolean(
        resolvedStartDate ||
        resolvedDueDate ||
        changes.startDateOffsetDays !== undefined ||
        changes.dueDateOffsetDays !== undefined,
      );
      if (hasDateChangeRequested && childStats.hasChildrenWithDates) {
        // Task has children AND at least one child has start or due dates scheduled!
        // Dates roll up automatically from children -> refuse modifying start / due date!
        dateChangeRefusedReason = `Cannot change start or due date for **${task.code}** because its dates roll up automatically from child tasks that have scheduled dates.`;
        dateRefusedCodes.push(task.code);
        resolvedStartDate = task.startDate;
        resolvedDueDate = task.dueDate;
      }

      // Check if any allowed change remains for this task
      const hasAllowedChange = Boolean(
        (changes.statusName && !statusChangeRefusedReason) ||
        (hasDateChangeRequested && !dateChangeRefusedReason) ||
        changes.severityName ||
        changes.assigneeName ||
        changes.assignee ||
        changes.name ||
        changes.description ||
        changes.estimateEffort,
      );

      if ((statusChangeRefusedReason || dateChangeRefusedReason) && !hasAllowedChange) {
        continue;
      }

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
        parentTaskHierarchyLevelConfigId: task.parentTask?.hierarchyLevelConfigId ?? (task.parentTask as any)?.hierarchyLevelConfig?.id,
        parentTaskHierarchyLevelName: task.parentTask?.hierarchyLevelName || (task.parentTask as any)?.hierarchyLevelConfig?.name,
        parentTaskHierarchyLevelIcon: task.parentTask?.hierarchyLevelIcon || (task.parentTask as any)?.hierarchyLevelConfig?.icon,
        parentTaskHierarchyLevelColor: task.parentTask?.hierarchyLevelColor || (task.parentTask as any)?.hierarchyLevelConfig?.color,
        parentTaskHierarchyLevelSequence: task.parentTask?.hierarchyLevelSequence ?? (task.parentTask as any)?.hierarchyLevelConfig?.sequence,
        hierarchyLevelConfigId: task.hierarchyLevelConfigId ?? task.hierarchyLevelConfig?.id,
        hierarchyLevelName: task.hierarchyLevelName || task.hierarchyLevelConfig?.name,
        hierarchyLevelColor: task.hierarchyLevelColor || task.hierarchyLevelConfig?.color,
        hierarchyLevelIcon: task.hierarchyLevelIcon || task.hierarchyLevelConfig?.icon,
        hierarchyLevelSequence: task.hierarchyLevelSequence ?? task.hierarchyLevelConfig?.sequence,
        hasChildren: childStats.hasChildren,
        hasChildrenWithDates: childStats.hasChildrenWithDates,
        statusId: resolvedStatusId ?? task.statusId,
        statusName: resolvedStatusName ?? task.statusName,
        statusColor: resolvedStatusColor ?? task.statusColor,
        severityId: resolvedSeverityId ?? task.severityId,
        severityName: resolvedSeverityName ?? task.severityName,
        severityColor: resolvedSeverityColor ?? task.severityColor,
        assigneeId: resolvedAssigneeId ?? task.assigneeId,
        assigneeName: resolvedAssigneeName ?? task.assigneeName,
        assigneeProfilePicUrl: resolvedAssigneePic ?? task.assigneeProfilePicUrl,
        startDate: resolvedStartDate ?? task.startDate,
        dueDate: resolvedDueDate ?? task.dueDate,
        estimateEffort: resolvedEffort ?? task.estimateEffort,
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

    const formatRefusedCodes = (codes: string[]) =>
      Array.from(new Set(codes)).map((c) => `**${c}**`).join(', ');

    const combinedRefusalMessages: string[] = [];
    if (statusRefusedCodes.length === 1) {
      combinedRefusalMessages.push(
        `Cannot change status for ${formatRefusedCodes(statusRefusedCodes)} because it has child tasks and its status rolls up automatically from its children. Please update its child tasks directly.`,
      );
    } else if (statusRefusedCodes.length > 1) {
      combinedRefusalMessages.push(
        `Cannot change status for ${formatRefusedCodes(statusRefusedCodes)} because they have child tasks and their status rolls up automatically from their children. Please update their child tasks directly.`,
      );
    }

    if (dateRefusedCodes.length === 1) {
      combinedRefusalMessages.push(
        `Cannot change start or due date for ${formatRefusedCodes(dateRefusedCodes)} because its dates roll up automatically from child tasks that have scheduled dates. Please update its child tasks directly.`,
      );
    } else if (dateRefusedCodes.length > 1) {
      combinedRefusalMessages.push(
        `Cannot change start or due date for ${formatRefusedCodes(dateRefusedCodes)} because their dates roll up automatically from child tasks that have scheduled dates. Please update their child tasks directly.`,
      );
    }

    if (combinedRefusalMessages.length > 0) {
      warnings.push(...combinedRefusalMessages);
    }

    if (preparedDrafts.length === 0 && combinedRefusalMessages.length > 0) {
      return {
        action: 'UPDATE_TASK',
        entityType: 'task',
        status: 'REFUSED',
        summary: combinedRefusalMessages.join('\n\n'),
        drafts: [],
        warnings: Array.from(new Set(warnings)),
      };
    }

    const changeSummaryParts: string[] = [];
    const seenChangeKeys = new Set<string>();
    for (const d of preparedDrafts) {
      if (changes.statusName && d.statusName && !seenChangeKeys.has(`status:${d.statusName}`)) {
        seenChangeKeys.add(`status:${d.statusName}`);
        changeSummaryParts.push(`status to **${d.statusName}**`);
      }
      if (changes.severityName && d.severityName && !seenChangeKeys.has(`severity:${d.severityName}`)) {
        seenChangeKeys.add(`severity:${d.severityName}`);
        changeSummaryParts.push(`priority to **${d.severityName}**`);
      }
      if (changes.assigneeName && d.assigneeName && !seenChangeKeys.has(`assignee:${d.assigneeName}`)) {
        seenChangeKeys.add(`assignee:${d.assigneeName}`);
        changeSummaryParts.push(`assignee to **${d.assigneeName}**`);
      }
      if ((changes.startDate || changes.dueDate) && !seenChangeKeys.has('dates')) {
        seenChangeKeys.add('dates');
        changeSummaryParts.push('dates');
      }
      if (changes.estimateEffort !== undefined && !seenChangeKeys.has('effort')) {
        seenChangeKeys.add('effort');
        changeSummaryParts.push(`effort to **${d.estimateEffort}h**`);
      }
    }
    const changeClause = changeSummaryParts.length > 0 ? ` — setting ${changeSummaryParts.join(', ')}` : '';

    const taskLabels = preparedDrafts.map((d) => `**${d.code}**`).join(', ');
    let displaySummary = '';
    if (isChildrenScope) {
      displaySummary = `I've prepared updates for all **${preparedDrafts.length} child tasks** of ${targets.join(', ')}${changeClause}. Please review the proposed changes below.`;
    } else if (preparedDrafts.length === 1) {
      const d = preparedDrafts[0];
      displaySummary = `I've prepared the update for task **${d.code}** (${d.name})${changeClause}. Please review the proposed changes below.`;
    } else if (preparedDrafts.length <= 3) {
      displaySummary = `I've prepared updates for **${preparedDrafts.length} tasks** (${taskLabels})${changeClause}. Please review the proposed changes below.`;
    } else {
      const f = mutationPayload.filter || {};
      const filterParts: string[] = [];
      const fSev = f.severity || f.severityName || f.priority;
      if (fSev) filterParts.push(`${String(fSev).trim()}-priority`);
      if (f.status) filterParts.push(String(f.status).trim());
      if (f.assignee && String(f.assignee).trim().toLowerCase() === 'unassigned') {
        filterParts.push('unassigned');
      }
      const filterPrefix = filterParts.length > 0 ? `${filterParts.join(' ')} ` : '';
      const assigneeSuffix =
        f.assignee && String(f.assignee).trim().toLowerCase() !== 'unassigned'
          ? ` assigned to **${f.assignee}**`
          : '';
      let targetNoun = 'tasks';
      if (f.hierarchyLevelName) {
        const rawLvl = String(f.hierarchyLevelName).trim().toLowerCase();
        targetNoun = rawLvl.endsWith('s') ? rawLvl : `${rawLvl}s`;
      } else if (Number(f.hierarchyLevelPosition) === 1) {
        targetNoun = 'root-level tasks';
      } else if (f.hierarchyLevelPosition) {
        targetNoun = `level-${f.hierarchyLevelPosition} tasks`;
      }
      displaySummary = `I've prepared updates for **${preparedDrafts.length} ${filterPrefix}${targetNoun}**${assigneeSuffix}${changeClause}. Please review the proposed changes below.`;
    }

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

    let hasSeverityJoin = false;
    let hasParentFilterJoin = false;
    const severityFilter = filter.severity || filter.severityName || filter.priority;
    const query = filter.query || filter.title || filter.name || filter.search;
    const queryPlan = mutationPayload.queryPlan;
    const hasHierarchyCond = Boolean(
      filter.hierarchyLevelName ||
      filter.hierarchyLevelPosition ||
      (Array.isArray(queryPlan?.conditions) &&
        queryPlan.conditions.some((c: any) => c?.field === 'hierarchyLevelName' || c?.field === 'hierarchyLevelPosition')),
    );
    const hasCodeRangeFilter =
      filter.codeRangeStart !== undefined &&
      filter.codeRangeStart !== null &&
      filter.codeRangeEnd !== undefined &&
      filter.codeRangeEnd !== null;
    const hasFilterCriteria = Boolean(
      hasCodeRangeFilter || filter.status || filter.assignee || severityFilter || query || filter.all || hasHierarchyCond,
    );

    const spaceLevelConfigs: Array<{ id: number; name: string; sequence: number }> =
      targetSpaceId && targetSpaceId !== 0 && hasHierarchyCond
        ? await this.entityManager.query(
            `SELECT "id", "name", "sequence" FROM task_space_hierarchy_level_config WHERE "taskSpaceId" = $1 ORDER BY "sequence" ASC`,
            [targetSpaceId],
          )
        : [];

    const normalizeLevel = (val: string) =>
      String(val || '')
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/g, '')
        .replace(/ies$/, 'y')
        .replace(/s$/, '');

    const applyHierarchyFilter = (pos?: number | null, levelName?: string | null) => {
      if (pos !== undefined && pos !== null && !isNaN(Number(pos))) {
        const p = Number(pos);
        const idx = Math.max(0, p - 1);
        const targetCfg = spaceLevelConfigs[idx];
        if (p === 1) {
          if (targetCfg) {
            qb.andWhere('(task.hierarchyLevelConfigId = :hlCfgId OR task.parentTaskId IS NULL)', {
              hlCfgId: Number(targetCfg.id),
            });
          } else {
            qb.andWhere('task.parentTaskId IS NULL');
          }
        } else if (p === 2) {
          if (!hasParentFilterJoin) {
            qb.leftJoin('task.parentTask', 'parentTaskFilter');
            hasParentFilterJoin = true;
          }
          if (targetCfg) {
            qb.andWhere(
              '(task.hierarchyLevelConfigId = :hlCfgId OR task.hierarchyLevelSequence = :hlSeq OR (task.hierarchyLevelConfigId IS NULL AND parentTaskFilter.id IS NOT NULL AND parentTaskFilter.parentTaskId IS NULL))',
              { hlCfgId: Number(targetCfg.id), hlSeq: Number(targetCfg.sequence) },
            );
          } else {
            qb.andWhere('(parentTaskFilter.id IS NOT NULL AND parentTaskFilter.parentTaskId IS NULL)');
          }
        } else {
          if (targetCfg) {
            qb.andWhere('(task.hierarchyLevelConfigId = :hlCfgId OR task.hierarchyLevelSequence = :hlSeq)', {
              hlCfgId: Number(targetCfg.id),
              hlSeq: Number(targetCfg.sequence),
            });
          } else {
            qb.andWhere('task.hierarchyLevelSequence = :hlPosSeq', { hlPosSeq: idx });
          }
        }
      }

      if (levelName && String(levelName).trim()) {
        const targetNorm = normalizeLevel(String(levelName));
        const matchedCfg =
          spaceLevelConfigs.find((c) => normalizeLevel(c.name) === targetNorm) ||
          spaceLevelConfigs.find((c) => normalizeLevel(c.name).includes(targetNorm) || targetNorm.includes(normalizeLevel(c.name)));

        if (matchedCfg) {
          const isRootCfg = spaceLevelConfigs[0] && Number(matchedCfg.id) === Number(spaceLevelConfigs[0].id);
          if (isRootCfg) {
            qb.andWhere(
              '(task.hierarchyLevelConfigId = :hlNameCfgId OR LOWER(task.hierarchyLevelName) = LOWER(:hlNameVal) OR task.parentTaskId IS NULL)',
              { hlNameCfgId: Number(matchedCfg.id), hlNameVal: matchedCfg.name },
            );
          } else {
            qb.andWhere(
              '(task.hierarchyLevelConfigId = :hlNameCfgId OR LOWER(task.hierarchyLevelName) = LOWER(:hlNameVal))',
              { hlNameCfgId: Number(matchedCfg.id), hlNameVal: matchedCfg.name },
            );
          }
        } else {
          qb.andWhere('LOWER(task.hierarchyLevelName) LIKE LOWER(:hlNameLike)', {
            hlNameLike: `%${String(levelName).trim()}%`,
          });
        }
      }
    };
    if (queryPlan?.conditions && Array.isArray(queryPlan.conditions) && queryPlan.conditions.length > 0) {
      // ── Semantic Query Plan Interpreter (AI Query Builder) ──
      for (const cond of queryPlan.conditions) {
        const { field, operator, value } = cond;
        if (!field) continue;

        if (field === 'code') {
          if (mutationPayload.explicitTargets === true || !hasFilterCriteria) {
            const codes = (Array.isArray(value) ? value : [value]).map((c) => String(c).toUpperCase());
            qb.andWhere('UPPER(task.code) IN (:...codes)', { codes });
          }
        } else if (field === 'statusBase') {
          const mapStatusBase = (v: any): string => {
            const norm = String(v || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
            if (norm === 'TOSTART') return StatusBaseEnum.TOSTART;
            if (norm === 'PROCESSING') return StatusBaseEnum.PROCESSING;
            if (norm === 'FINISHED') return StatusBaseEnum.FINISHED;
            return String(v);
          };
          if (operator === 'in') {
            const bases = (Array.isArray(value) ? value : [value]).map(mapStatusBase);
            qb.andWhere('task.statusBase IN (:...bases)', { bases });
          } else if (operator === 'neq') {
            qb.andWhere('task.statusBase != :baseVal', { baseVal: mapStatusBase(value) });
          }
        } else if (field === 'statusName' || field === 'status') {
          if (operator === 'not_in') {
            const names = (Array.isArray(value) ? value : [value]).map((n) => String(n).toLowerCase());
            qb.andWhere('LOWER(task.statusName) NOT IN (:...namesLow)', { namesLow: names });
          } else if (operator === 'ilike' || operator === 'like') {
            qb.andWhere('LOWER(task.statusName) LIKE LOWER(:stVal)', { stVal: String(value) });
          } else if (operator === 'eq') {
            qb.andWhere('LOWER(task.statusName) = LOWER(:stVal)', { stVal: String(value) });
          }
        } else if (field === 'assignee' || field === 'assigneeName') {
          if (operator === 'is_null' || value === 'unassigned') {
            qb.andWhere('(task.assigneeId IS NULL OR task.assigneeName IS NULL OR task.assigneeName = :emptyStr)', { emptyStr: '' });
          } else if (operator === 'eq' && (value === 'me' || value === 'self')) {
            const authEmail = (authUser?.email || '').trim().toLowerCase();
            const authName = (authUser?.name || '').trim().toLowerCase();
            qb.andWhere('(LOWER(task.assigneeEmail) = :authEmail OR LOWER(task.assigneeName) = :authName)', { authEmail, authName });
          } else {
            const asgVal = String(value).replace(/^%+|%+$/g, '').trim();
            qb.andWhere('LOWER(task.assigneeName) LIKE LOWER(:assigneeVal)', { assigneeVal: `%${asgVal}%` });
          }
        } else if (field === 'severity' || field === 'severityName') {
          if (!hasSeverityJoin) {
            qb.leftJoin('task.severity', 'taskSeverity');
            hasSeverityJoin = true;
          }
          const sevVal = String(value).replace(/^%+|%+$/g, '').trim();
          qb.andWhere(
            "LOWER(COALESCE(NULLIF(TRIM(taskSeverity.name), ''), task.severityName)) LIKE LOWER(:sevVal)",
            { sevVal: `%${sevVal}%` },
          );
        } else if (field === 'name' || field === 'query' || field === 'title') {
          const q = String(value).trim().toLowerCase();
          const rawTokens = q.split(/\s+/).filter((w) => w.length >= 3 && !['task', 'the', 'for', 'of', 'update', 'start', 'date', 'validate'].includes(w));
          if (rawTokens.length > 0) {
            qb.andWhere(
              new Brackets((subQb) => {
                subQb.where('(LOWER(task.code) LIKE :q OR LOWER(task.name) LIKE :q)', { q: `%${q}%` });
                rawTokens.forEach((tok, idx) => {
                  const prefixTok = tok.slice(0, Math.min(tok.length, 5));
                  subQb.orWhere(`LOWER(task.name) LIKE :tok${idx} OR LOWER(task.code) LIKE :tok${idx}`, {
                    [`tok${idx}`]: `%${prefixTok}%`,
                  });
                });
              }),
            );
          } else {
            qb.andWhere('(LOWER(task.code) LIKE :q OR LOWER(task.name) LIKE :q)', { q: `%${q}%` });
          }
        } else if (field === 'hierarchyLevelPosition') {
          applyHierarchyFilter(Number(value), null);
        } else if (field === 'hierarchyLevelName') {
          applyHierarchyFilter(null, String(value));
        } else if (field === 'codeRange' && value && typeof value === 'object') {
          const rangeStart = Number(value.start);
          const rangeEnd = Number(value.end);
          if (!Number.isNaN(rangeStart) && !Number.isNaN(rangeEnd)) {
            const minNum = Math.min(rangeStart, rangeEnd);
            const maxNum = Math.max(rangeStart, rangeEnd);
            if (value.prefix) {
              const rawPrefix = String(value.prefix).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
              const prefixRegex = rawPrefix.includes('-')
                ? `^${rawPrefix}[0-9]+$`
                : `^${rawPrefix}-[A-Za-z]*[0-9]+$`;
              qb.andWhere('UPPER(task.code) ~ :codeRangePrefixRegex', {
                codeRangePrefixRegex: prefixRegex,
              });
            } else {
              qb.andWhere("task.code ~ '[0-9]+$'");
            }
            qb.andWhere("CAST(SUBSTRING(task.code FROM '([0-9]+)$') AS INT) BETWEEN :rangeStart AND :rangeEnd", {
              rangeStart: minNum,
              rangeEnd: maxNum,
            });
          }
        }
      }
    } else {
      if (filter.status) {
        const statusTerm = String(filter.status).trim().toLowerCase();
        let baseTerm: string | null = null;
        if (statusTerm === 'unresolved' || statusTerm === 'not resolved' || statusTerm === 'active') {
          qb.andWhere('(task.statusBase != :finishedBase AND LOWER(task.statusName) NOT IN (:...finishedNames))', {
            finishedBase: StatusBaseEnum.FINISHED,
            finishedNames: ['resolved', 'closed', 'done', 'cancelled', 'completed'],
          });
        } else if (/^(open|todo|to\s*do|to\s*start|new|backlog)$/i.test(statusTerm)) {
          baseTerm = StatusBaseEnum.TOSTART;
        } else if (/^(in\s*progress|ongoing|processing|in\s*review)$/i.test(statusTerm)) {
          baseTerm = StatusBaseEnum.PROCESSING;
        } else if (/^(done|closed|resolved|completed)$/i.test(statusTerm)) {
          baseTerm = StatusBaseEnum.FINISHED;
        }

        if (baseTerm) {
          qb.andWhere('(LOWER(task.statusName) = :status OR task.statusBase = :baseTerm)', {
            status: statusTerm,
            baseTerm,
          });
        } else if (statusTerm !== 'unresolved' && statusTerm !== 'not resolved' && statusTerm !== 'active') {
          qb.andWhere('LOWER(task.statusName) = :status', { status: statusTerm });
        }
      }

      if (filter.assignee) {
        const av = String(filter.assignee).trim().toLowerCase();
        if (['unassigned', 'unassign', 'none', 'no one'].includes(av)) {
          qb.andWhere('(task.assigneeId IS NULL OR task.assigneeName IS NULL OR task.assigneeName = :emptyStr)', { emptyStr: '' });
        } else if (['me', 'myself', 'i', 'self'].includes(av)) {
          const authEmail = (authUser?.email || '').trim().toLowerCase();
          const authName = (authUser?.name || '').trim().toLowerCase();
          qb.andWhere('(LOWER(task.assigneeEmail) = :authEmail OR LOWER(task.assigneeName) = :authName)', { authEmail, authName });
        } else {
          qb.andWhere('LOWER(task.assigneeName) LIKE LOWER(:assignee)', { assignee: `%${filter.assignee}%` });
        }
      }

      // Filter by severity/priority if requested (e.g. "all low-priority tasks")
      if (severityFilter) {
        const sev = String(severityFilter).trim().toLowerCase();
        if (!hasSeverityJoin) {
          qb.leftJoin('task.severity', 'taskSeverity');
          hasSeverityJoin = true;
        }
        qb.andWhere(
          "LOWER(COALESCE(NULLIF(TRIM(taskSeverity.name), ''), task.severityName)) LIKE :severity",
          { severity: `%${sev}%` },
        );
      }

      if (filter.hierarchyLevelPosition || filter.hierarchyLevelName) {
        applyHierarchyFilter(filter.hierarchyLevelPosition, filter.hierarchyLevelName);
      }

      if (hasCodeRangeFilter) {
        const minNum = Math.min(Number(filter.codeRangeStart), Number(filter.codeRangeEnd));
        const maxNum = Math.max(Number(filter.codeRangeStart), Number(filter.codeRangeEnd));
        if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
          qb.andWhere("task.code ~ '[0-9]+$'");
          qb.andWhere("CAST(SUBSTRING(task.code FROM '([0-9]+)$') AS INT) BETWEEN :rangeStart AND :rangeEnd", {
            rangeStart: minNum,
            rangeEnd: maxNum,
          });
        }
      }

      if (query) {
        const q = String(query).trim().toLowerCase();
        // Token-aware search for multi-word or fuzzy references
        const rawTokens = q.split(/\s+/).filter((w) => w.length >= 3 && !['task', 'the', 'for', 'of', 'update', 'start', 'date', 'validate'].includes(w));
        if (rawTokens.length > 0) {
          qb.andWhere(
            new Brackets((subQb) => {
              subQb.where('(LOWER(task.code) LIKE :q OR LOWER(task.name) LIKE :q)', { q: `%${q}%` });
              rawTokens.forEach((tok, idx) => {
                const prefixTok = tok.slice(0, Math.min(tok.length, 5));
                subQb.orWhere(`LOWER(task.name) LIKE :tok${idx} OR LOWER(task.code) LIKE :tok${idx}`, {
                  [`tok${idx}`]: `%${prefixTok}%`,
                });
              });
            }),
          );
        } else {
          qb.andWhere('(LOWER(task.code) LIKE :q OR LOWER(task.name) LIKE :q)', { q: `%${q}%` });
        }
      }
    }

    const isBulkScope = queryPlan?.targetScope === 'all' || filter.all === true;
    const taskLimit = isBulkScope ? 50 : 10;
    const candidates = await qb.orderBy('task.id', 'DESC').take(taskLimit).getMany();

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

