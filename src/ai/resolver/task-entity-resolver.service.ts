import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, ILike, In, IsNull } from 'typeorm';
import { Task } from '../../task-management/task/task.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { TaskSpaceHierarchyLevelConfig } from '../../task-management/task-space-hierarchy-level/task-space-hierarchy-level-config.entity';
import { TaskSpaceStatusConfig } from '../../task-management/task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../../task-management/task-space-severity-config/task-space-severity-config.entity';
import { Resource } from '../../resource-management/resource/resource.entity';

export interface TaskResolutionResult {
  resolvedDraft: any;
  warnings: string[];
  needs?: any[];
  summary?: string;
}

@Injectable()
export class TaskEntityResolverService {
  private readonly logger = new Logger(TaskEntityResolverService.name);

  constructor(private readonly entityManager: EntityManager) {}

  /**
   * Resolves fuzzy names and missing relations for Task Creation Drafts.
   * Handles space lookup, dynamic hierarchy level configs (sequence 1 custom names),
   * parent project disambiguation (with "Create as new [Level 1]" option),
   * and strict scoping of assignees to task_space_resources.
   */
  async resolveDraftEntities(
    draftOrDrafts: any,
    companyId: number,
    allowedSpaceIds: number[] = [],
    currentUser?: any,
    context?: any,
  ): Promise<TaskResolutionResult> {
    if (!draftOrDrafts || typeof draftOrDrafts !== 'object') {
      return { resolvedDraft: draftOrDrafts, warnings: [] };
    }

    if (Array.isArray(draftOrDrafts)) {
      const resolvedList: any[] = [];
      const allWarnings: string[] = [];
      let overallNeeds: any[] = [];
      let overallSummary: string | undefined;

      for (const d of draftOrDrafts) {
        const res = await this.resolveSingleDraft(d, companyId, allowedSpaceIds, currentUser, draftOrDrafts, context);
        if (res.resolvedDraft) {
          d.hierarchyLevelSequence = res.resolvedDraft.hierarchyLevelSequence;
          d.hierarchyLevelConfigId = res.resolvedDraft.hierarchyLevelConfigId;
          d.hierarchyLevelName = res.resolvedDraft.hierarchyLevelName;
          d.hierarchyLevelIcon = res.resolvedDraft.hierarchyLevelIcon;
          d.hierarchyLevelColor = res.resolvedDraft.hierarchyLevelColor;
        }
        resolvedList.push({
          ...res.resolvedDraft,
          warnings: res.warnings,
        });
        for (const w of res.warnings) {
          if (!allWarnings.includes(w)) allWarnings.push(w);
        }
        if (res.needs && res.needs.length > 0 && overallNeeds.length === 0) {
          overallNeeds = res.needs;
          overallSummary = res.summary;
        }
      }
      return {
        resolvedDraft: resolvedList,
        warnings: allWarnings,
        needs: overallNeeds,
        summary: overallSummary,
      };
    }

    return this.resolveSingleDraft(draftOrDrafts, companyId, allowedSpaceIds, currentUser, [], context);
  }

  private async resolveSingleDraft(
    draft: any,
    companyId: number,
    allowedSpaceIds: number[] = [],
    currentUser?: any,
    batchDrafts: any[] = [],
    context?: any,
  ): Promise<TaskResolutionResult> {
    if (!draft || typeof draft !== 'object') {
      return { resolvedDraft: draft, warnings: [] };
    }

    const resolved = { ...draft };
    const warnings: string[] = [];
    const needs: any[] = [];
    let summary: string | undefined;

    // 1. Resolve Task Space
    let taskSpace: TaskSpace | null = null;
    const whereBase: any = {};
    if (companyId && companyId !== 0) {
      whereBase.companyId = companyId;
    }

    // Populate from context if not present in draft
    if (!resolved.taskSpaceId && context) {
      const ctxSpaceId = context.taskSpaceId || context.task_space_id || context.spaceId;
      if (ctxSpaceId && ctxSpaceId !== 'none') {
        resolved.taskSpaceId = Number(ctxSpaceId);
      }
    }
    if (!resolved.taskSpaceName && context) {
      const ctxSpaceName = context.taskSpaceName || context.task_space_name || context.spaceName;
      if (ctxSpaceName && ctxSpaceName !== 'none') {
        resolved.taskSpaceName = ctxSpaceName;
      }
    }

    if (resolved.taskSpaceId) {
      taskSpace = await this.entityManager.findOne(TaskSpace, {
        where: { id: Number(resolved.taskSpaceId), ...whereBase },
        relations: ['hierarchyLevelConfigs', 'statusConfigs', 'resources'],
      });
    }

    if (!taskSpace && resolved.taskSpaceName) {
      const nameClean = String(resolved.taskSpaceName).trim();
      taskSpace = await this.entityManager.findOne(TaskSpace, {
        where: { name: ILike(`%${nameClean}%`), ...whereBase },
        relations: ['hierarchyLevelConfigs', 'statusConfigs', 'resources'],
      });
    }

    // If still no task space, fetch available active task spaces for disambiguation
    if (!taskSpace) {
      const availableSpaces = await this.entityManager.find(TaskSpace, {
        where: { isActive: true, ...whereBase },
        order: { name: 'ASC' },
        take: 10,
      });

      needs.push({
        field: 'taskSpace',
        label: 'Select Task Space',
        options: availableSpaces.map((s) => ({
          id: s.id,
          name: s.name,
          prefix: s.prefix,
        })),
      });

      summary = 'Which task space should I place this in?';
      return { resolvedDraft: resolved, warnings, needs, summary };
    }

    // Populate resolved space metadata
    resolved.taskSpaceId = taskSpace.id;
    resolved.taskSpaceName = taskSpace.name;
    resolved.taskSpacePrefix = taskSpace.prefix;

    // 2. Load Space Hierarchy Configurations
    const hierarchyConfigs = await this.entityManager.find(TaskSpaceHierarchyLevelConfig, {
      where: { taskSpaceId: taskSpace.id },
      order: { sequence: 'ASC' },
    });

    // The root level is the first configuration (sequence 0 or 1, whichever is the space's top level)
    const rootLevelConfig =
      hierarchyConfigs.length > 0
        ? hierarchyConfigs[0]
        : {
            id: 0,
            sequence: 0,
            name: 'Project',
            icon: 'Folder',
            color: '#6366f1',
          };

    const rootTaskLevelName = rootLevelConfig.name || 'Project';

    const level2Config =
      hierarchyConfigs.length > 1
        ? hierarchyConfigs[1]
        : {
            id: 0,
            sequence: (rootLevelConfig.sequence ?? 0) + 1,
            name: 'Task',
            icon: 'CheckSquare',
            color: '#3b82f6',
          };

    // 3. Parent Task & Hierarchy Level Disambiguation
    // Check if user specifically requested top-level item (sequence 0 / explicit root)
    const isExplicitLevel1 =
      resolved.parentTaskId === -1 ||
      resolved.isCreateNewLevel1 ||
      resolved.isExplicitRoot === true ||
      (resolved.parentTaskName && resolved.parentTaskName.toLowerCase().includes('create as new')) ||
      (resolved.parentTaskName && resolved.parentTaskName.toLowerCase().includes(`new ${rootTaskLevelName.toLowerCase()}`)) ||
      (resolved.parentTaskName && resolved.parentTaskName.toLowerCase().includes('as a new'));

    // Special selection from UI: if user clicked "Create as new [rootTaskLevelName]" (id: -1)
    if (isExplicitLevel1) {
      resolved.parentTaskId = null;
      resolved.parentTaskName = null;
      resolved.hierarchyLevelConfigId = rootLevelConfig.id;
      resolved.hierarchyLevelName = rootLevelConfig.name;
      resolved.hierarchyLevelIcon = rootLevelConfig.icon;
      resolved.hierarchyLevelColor = rootLevelConfig.color;
      resolved.hierarchyLevelSequence = rootLevelConfig.sequence ?? 0;
    } else if (resolved.parentTaskId && resolved.parentTaskId > 0) {
      // Parent ID is explicitly provided
      const parentTask = await this.entityManager.findOne(Task, {
        where: { id: Number(resolved.parentTaskId), taskSpaceId: taskSpace.id },
      });
      if (parentTask) {
        resolved.parentTaskId = parentTask.id;
        resolved.parentTaskName = parentTask.name;
        resolved.parentTaskCode = parentTask.code;
        resolved.parentTaskStatusId = parentTask.statusId;
        resolved.parentTaskStatusName = parentTask.statusName;
        resolved.parentTaskStatusColor = parentTask.statusColor;
        resolved.parentTaskSeverityId = parentTask.severityId;
        resolved.parentTaskSeverityName = parentTask.severityName;
        resolved.parentTaskSeverityColor = parentTask.severityColor;
        resolved.parentTaskAssigneeId = parentTask.assigneeId;
        resolved.parentTaskAssigneeName = parentTask.assigneeName;
        resolved.parentTaskAssigneeProfilePicUrl = parentTask.assigneeProfilePicUrl;
        resolved.parentTaskStartDate = parentTask.startDate;
        resolved.parentTaskDueDate = parentTask.dueDate;

        // Child takes the next sequence level
        const parentSeq = parentTask.hierarchyLevelSequence ?? rootLevelConfig.sequence ?? 0;
        const childSeq = parentSeq + 1;
        const matchingLevel =
          hierarchyConfigs.find((c) => c.sequence === childSeq) ||
          (hierarchyConfigs.length > childSeq ? hierarchyConfigs[childSeq] : null) ||
          level2Config;
        resolved.hierarchyLevelConfigId = matchingLevel.id;
        resolved.hierarchyLevelName = matchingLevel.name;
        resolved.hierarchyLevelIcon = matchingLevel.icon;
        resolved.hierarchyLevelColor = matchingLevel.color;
        resolved.hierarchyLevelSequence = matchingLevel.sequence ?? childSeq;
      }
    } else if (resolved.parentTaskName) {
      // Fuzzy parent task name / code lookup
      const rawParent = String(resolved.parentTaskName).trim();
      let extractedCode: string | null = null;
      let cleanName = rawParent;

      const codeMatch = rawParent.match(/^([A-Za-z0-9_-]+)(?::\s*(.*))?$/);
      if (codeMatch) {
        extractedCode = codeMatch[1].trim();
        cleanName = (codeMatch[2] || '').trim();
      }

      const whereConditions: any[] = [];
      if (extractedCode) {
        whereConditions.push({ code: extractedCode.toUpperCase(), taskSpaceId: taskSpace.id });
      }
      if (cleanName) {
        whereConditions.push({ name: ILike(`%${cleanName}%`), taskSpaceId: taskSpace.id });
      }
      whereConditions.push({ name: ILike(`%${rawParent}%`), taskSpaceId: taskSpace.id });
      whereConditions.push({ code: rawParent.toUpperCase(), taskSpaceId: taskSpace.id });

      const parentTask = await this.entityManager.findOne(Task, {
        where: whereConditions,
      });
      if (parentTask) {
        resolved.parentTaskId = parentTask.id;
        resolved.parentTaskName = parentTask.name;
        resolved.parentTaskCode = parentTask.code;
        resolved.parentTaskStatusId = parentTask.statusId;
        resolved.parentTaskStatusName = parentTask.statusName;
        resolved.parentTaskStatusColor = parentTask.statusColor;
        resolved.parentTaskSeverityId = parentTask.severityId;
        resolved.parentTaskSeverityName = parentTask.severityName;
        resolved.parentTaskSeverityColor = parentTask.severityColor;
        resolved.parentTaskAssigneeId = parentTask.assigneeId;
        resolved.parentTaskAssigneeName = parentTask.assigneeName;
        resolved.parentTaskAssigneeProfilePicUrl = parentTask.assigneeProfilePicUrl;
        resolved.parentTaskStartDate = parentTask.startDate;
        resolved.parentTaskDueDate = parentTask.dueDate;
        const parentSeq = parentTask.hierarchyLevelSequence ?? rootLevelConfig.sequence ?? 0;
        const childSeq = parentSeq + 1;
        const matchingLevel =
          hierarchyConfigs.find((c) => c.sequence === childSeq) ||
          (hierarchyConfigs.length > childSeq ? hierarchyConfigs[childSeq] : null) ||
          level2Config;
        resolved.hierarchyLevelConfigId = matchingLevel.id;
        resolved.hierarchyLevelName = matchingLevel.name;
        resolved.hierarchyLevelIcon = matchingLevel.icon;
        resolved.hierarchyLevelColor = matchingLevel.color;
        resolved.hierarchyLevelSequence = matchingLevel.sequence ?? childSeq;
      }
    }

    // Check if this draft is a child of another draft within the same batch
    const parentDraft =
      batchDrafts &&
      resolved.parentTaskName &&
      batchDrafts.find(
        (other) =>
          other !== draft &&
          other.name &&
          other.name.trim().toLowerCase() === resolved.parentTaskName.trim().toLowerCase(),
      );

    const isChildOfBatchDraft = !!parentDraft;

    if (parentDraft) {
      // Child of another draft in this batch! Sequence is parent draft's sequence + 1
      let parentSeq = parentDraft.hierarchyLevelSequence;
      if (parentSeq === undefined) {
        const isParentRoot =
          !parentDraft.parentTaskId &&
          !parentDraft.parentTaskName;
        parentSeq = isParentRoot
          ? (rootLevelConfig.sequence ?? 0)
          : (level2Config.sequence ?? 1);
      }
      const childSeq = parentSeq + 1;
      const matchingLevel =
        hierarchyConfigs.find((c) => c.sequence === childSeq) ||
        (hierarchyConfigs.length > childSeq ? hierarchyConfigs[childSeq] : null) ||
        hierarchyConfigs[hierarchyConfigs.length - 1] ||
        level2Config;

      resolved.hierarchyLevelConfigId = matchingLevel.id;
      resolved.hierarchyLevelName = matchingLevel.name;
      resolved.hierarchyLevelIcon = matchingLevel.icon;
      resolved.hierarchyLevelColor = matchingLevel.color;
      resolved.hierarchyLevelSequence = matchingLevel.sequence ?? childSeq;
    }

    // If still no parent and not explicit level 1 and not a child of another drafted item, ask user for root container
    if (!resolved.parentTaskId && !isExplicitLevel1 && !isChildOfBatchDraft) {
      if (
        resolved.hierarchyLevelSequence === rootLevelConfig.sequence ||
        !resolved.hierarchyLevelSequence
      ) {
        resolved.hierarchyLevelSequence = level2Config.sequence ?? ((rootLevelConfig.sequence ?? 0) + 1);
        resolved.hierarchyLevelName = level2Config.name || 'Task';
        resolved.hierarchyLevelConfigId = level2Config.id;
        resolved.hierarchyLevelIcon = level2Config.icon;
        resolved.hierarchyLevelColor = level2Config.color;
      }
      // Query existing Level 1 root items in this task space
      const rootTasks = await this.entityManager.find(Task, {
        where: {
          taskSpaceId: taskSpace.id,
          parentTaskId: IsNull(),
        },
        order: { id: 'DESC' },
        take: 10,
      });

      const options = rootTasks.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        label: `${t.code}: ${t.name}`,
      }));

      // Append special option: "Create as new {{root task level name}}"
      options.push({
        id: -1,
        name: `Create as new ${rootTaskLevelName}`,
        code: 'NEW',
        label: `Create as new ${rootTaskLevelName}`,
      });

      needs.push({
        field: 'parentTask',
        label: `Under what ${rootTaskLevelName}?`,
        options,
      });

      summary = `Under what ${rootTaskLevelName} should I create the ${batchDrafts && batchDrafts.length > 1 ? 'tasks' : 'task'}?`;
    }

    // 4. Strict Assignee Scoping to task_space_resources
    if (resolved.assigneeName) {
      const rawAssignee = String(resolved.assigneeName).trim();
      // Fetch resources assigned to this task space
      const spaceWithResources = await this.entityManager.findOne(TaskSpace, {
        where: { id: taskSpace.id },
        relations: ['resources'],
      });

      const assignedResources = spaceWithResources?.resources || [];
      let matchedResource: Resource | undefined;

      if (rawAssignee.toLowerCase() === 'me' && currentUser) {
        matchedResource = assignedResources.find(
          (r) =>
            r.email?.toLowerCase() === currentUser.email?.toLowerCase() ||
            `${r.first_name} ${r.last_name}`.toLowerCase() === currentUser.name?.toLowerCase(),
        );
      } else {
        matchedResource = assignedResources.find((r) => {
          const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
          const q = rawAssignee.toLowerCase();
          return fullName.includes(q) || r.first_name?.toLowerCase() === q || r.last_name?.toLowerCase() === q;
        });
      }

      if (matchedResource) {
        resolved.assigneeId = matchedResource.id;
        resolved.assigneeName = `${matchedResource.first_name} ${matchedResource.last_name}`.trim();
        resolved.assigneeEmail = matchedResource.email;
        resolved.assigneeProfilePicUrl = matchedResource.profile_pic;
      } else {
        resolved.assigneeId = null;
        warnings.push(
          `Assignee "${rawAssignee}" is not assigned to space "${taskSpace.name}". Please select from assigned space resources.`,
        );
      }
    }

    // 5. Status Resolution
    const statusConfigs = await this.entityManager.find(TaskSpaceStatusConfig, {
      where: { taskSpaceId: taskSpace.id },
      order: { sequence: 'ASC' },
    });

    if (resolved.statusName) {
      const q = String(resolved.statusName).trim().toLowerCase();
      const matchedStatus = statusConfigs.find((s) => s.name?.toLowerCase() === q);
      if (matchedStatus) {
        resolved.statusId = matchedStatus.id;
        resolved.statusName = matchedStatus.name;
        resolved.statusColor = matchedStatus.color;
      }
    }
    if (!resolved.statusId && statusConfigs.length > 0) {
      // Default to first status
      resolved.statusId = statusConfigs[0].id;
      resolved.statusName = statusConfigs[0].name;
      resolved.statusColor = statusConfigs[0].color;
    }

    // 6. Severity Resolution
    const severityConfigs = await this.entityManager.find(TaskSpaceSeverityConfig, {
      where: { taskSpaceId: taskSpace.id },
      order: { id: 'ASC' },
    });

    if (resolved.severityName) {
      const q = String(resolved.severityName).trim().toLowerCase();
      const matchedSev = severityConfigs.find((s) => s.name?.toLowerCase() === q);
      if (matchedSev) {
        resolved.severityId = matchedSev.id;
        resolved.severityName = matchedSev.name;
        resolved.severityColor = matchedSev.color;
      }
    }
    if (!resolved.severityId && severityConfigs.length > 0) {
      const defaultSev = severityConfigs.find((s) => s.name?.toLowerCase() === 'medium') || severityConfigs[0];
      resolved.severityId = defaultSev.id;
      resolved.severityName = defaultSev.name;
      resolved.severityColor = defaultSev.color;
    }

    // 7. Sanitize Dates & Numeric Estimates
    if (resolved.estimateEffort) {
      const parsedEffort = parseFloat(String(resolved.estimateEffort).replace(/[^0-9.]/g, ''));
      resolved.estimateEffort = isNaN(parsedEffort) ? null : parsedEffort;
    }

    return { resolvedDraft: resolved, warnings, needs, summary };
  }
}
