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

    // 0. Check if cloning an existing task or project (with all levels children)
    const rawInputList = Array.isArray(draftOrDrafts) ? draftOrDrafts : [draftOrDrafts];
    const firstItem = rawInputList[0];
    const sourceCode = (
      firstItem?.sourceTaskCode ||
      (firstItem?.name && String(firstItem.name).match(/\b([A-Za-z0-9_-]+-(?:P\d+|\d+(?:-\w+)*))\b/)?.[1]) ||
      context?.mentionedCode ||
      (context?.mentionedItems && context.mentionedItems[0]?.code)
    );
    const isCloneReq = Boolean(
      firstItem?.sourceTaskCode ||
      firstItem?.cloneChildren ||
      (firstItem?.name && /duplicate|clone|copy/i.test(firstItem.name)) ||
      (context?.mentionedCode && rawInputList.some((d: any) => d?.name && /duplicate|clone|copy/i.test(d.name)))
    );

    if (isCloneReq && sourceCode) {
      try {
        const sourceTask = await this.entityManager
          .createQueryBuilder(Task, 'task')
          .leftJoinAndSelect('task.taskSpace', 'taskSpace')
          .leftJoinAndSelect('task.hierarchyLevelConfig', 'hierarchyLevelConfig')
          .leftJoinAndSelect('task.status', 'status')
          .leftJoinAndSelect('task.severity', 'severity')
          .leftJoinAndSelect('task.assignee', 'assignee')
          .where('task.companyId = :companyId', { companyId })
          .andWhere('UPPER(task.code) = UPPER(:code)', { code: String(sourceCode).trim().toUpperCase() })
          .getOne();

        if (sourceTask) {
          const isProject = !sourceTask.parentTaskId || /-P\d+$/.test(sourceTask.code);
          const rootCloneName = `${sourceTask.name} (Copy)`;

          // Fetch Level 1 children
          const level1Children = await this.entityManager
            .createQueryBuilder(Task, 'task')
            .leftJoinAndSelect('task.hierarchyLevelConfig', 'hierarchyLevelConfig')
            .leftJoinAndSelect('task.status', 'status')
            .leftJoinAndSelect('task.severity', 'severity')
            .leftJoinAndSelect('task.assignee', 'assignee')
            .where('task.companyId = :companyId', { companyId })
            .andWhere('task.parentTaskId = :parentId', { parentId: sourceTask.id })
            .orderBy('task.id', 'ASC')
            .getMany();

          // Fetch Level 2 subtasks
          let level2Subtasks: Task[] = [];
          if (level1Children.length > 0) {
            const l1Ids = level1Children.map((t) => t.id);
            level2Subtasks = await this.entityManager
              .createQueryBuilder(Task, 'task')
              .leftJoinAndSelect('task.hierarchyLevelConfig', 'hierarchyLevelConfig')
              .leftJoinAndSelect('task.status', 'status')
              .leftJoinAndSelect('task.severity', 'severity')
              .leftJoinAndSelect('task.assignee', 'assignee')
              .where('task.companyId = :companyId', { companyId })
              .andWhere('task.parentTaskId IN (:...parentIds)', { parentIds: l1Ids })
              .orderBy('task.id', 'ASC')
              .getMany();
          }

          const clonedTree: any[] = [];
          // Root Project / Task
          clonedTree.push({
            name: rootCloneName,
            isCreateNewLevel1: isProject,
            hierarchyLevelSequence: sourceTask.hierarchyLevelConfig?.sequence ?? 0,
            hierarchyLevelName: sourceTask.hierarchyLevelConfig?.name || 'Project',
            hierarchyLevelIcon: sourceTask.hierarchyLevelConfig?.icon || 'folder',
            hierarchyLevelColor: sourceTask.hierarchyLevelConfig?.color || '#3b82f6',
            hierarchyLevelConfigId: sourceTask.hierarchyLevelConfig?.id,
            entityType: 'task',
            taskSpaceId: sourceTask.taskSpaceId,
            taskSpaceName: sourceTask.taskSpace?.name,
            severityName: sourceTask.severity?.name || 'Medium',
            severityId: sourceTask.severityId,
            statusName: 'To Do',
            description: sourceTask.description,
            assigneeName: sourceTask.assigneeName || (sourceTask.assignee ? `${sourceTask.assignee.first_name || ''} ${sourceTask.assignee.last_name || ''}`.trim() : null),
            assigneeId: sourceTask.assigneeId,
          });

          // Level 1 Tasks
          for (const l1 of level1Children) {
            clonedTree.push({
              name: l1.name,
              parentTaskName: rootCloneName,
              hierarchyLevelSequence: l1.hierarchyLevelConfig?.sequence ?? 1,
              hierarchyLevelName: l1.hierarchyLevelConfig?.name || 'Task',
              hierarchyLevelIcon: l1.hierarchyLevelConfig?.icon || 'check-square',
              hierarchyLevelColor: l1.hierarchyLevelConfig?.color || '#10b981',
              hierarchyLevelConfigId: l1.hierarchyLevelConfig?.id,
              entityType: 'task',
              taskSpaceId: sourceTask.taskSpaceId,
              taskSpaceName: sourceTask.taskSpace?.name,
              severityName: l1.severity?.name || 'Medium',
              severityId: l1.severityId,
              statusName: 'To Do',
              description: l1.description,
              assigneeName: l1.assigneeName || (l1.assignee ? `${l1.assignee.first_name || ''} ${l1.assignee.last_name || ''}`.trim() : null),
              assigneeId: l1.assigneeId,
            });
          }

          // Level 2 Subtasks
          for (const l2 of level2Subtasks) {
            const l1Parent = level1Children.find((p) => p.id === l2.parentTaskId);
            clonedTree.push({
              name: l2.name,
              parentTaskName: l1Parent ? l1Parent.name : rootCloneName,
              hierarchyLevelSequence: l2.hierarchyLevelConfig?.sequence ?? 2,
              hierarchyLevelName: l2.hierarchyLevelConfig?.name || 'Subtask',
              hierarchyLevelIcon: l2.hierarchyLevelConfig?.icon || 'check-circle-2',
              hierarchyLevelColor: l2.hierarchyLevelConfig?.color || '#f59e0b',
              hierarchyLevelConfigId: l2.hierarchyLevelConfig?.id,
              entityType: 'task',
              taskSpaceId: sourceTask.taskSpaceId,
              taskSpaceName: sourceTask.taskSpace?.name,
              severityName: l2.severity?.name || 'Medium',
              severityId: l2.severityId,
              statusName: 'To Do',
              description: l2.description,
              assigneeName: l2.assigneeName || (l2.assignee ? `${l2.assignee.first_name || ''} ${l2.assignee.last_name || ''}`.trim() : null),
              assigneeId: l2.assigneeId,
            });
          }

          draftOrDrafts = clonedTree;
        }
      } catch (err) {
        this.logger.error('Error hydrating cloned task tree:', err);
      }
    }

    if (Array.isArray(draftOrDrafts)) {
      let list = draftOrDrafts.map((d: any) => ({ ...d }));

      const hasCreateNewLevel1 = list.some((d) => d.isCreateNewLevel1 || d.parentTaskId === -1);
      const uncreatedParent = list.find((d) => d.parentTaskName && !list.some((other) => other.name?.trim().toLowerCase() === d.parentTaskName?.trim().toLowerCase()));

      if (hasCreateNewLevel1 && uncreatedParent?.parentTaskName) {
        const pName = uncreatedParent.parentTaskName.trim();
        if (!list.some((d) => d.name?.trim().toLowerCase() === pName.toLowerCase())) {
          list.unshift({
            name: pName,
            isCreateNewLevel1: true,
            hierarchyLevelSequence: 0,
            entityType: 'task',
            taskSpaceId: list[0]?.taskSpaceId,
            taskSpaceName: list[0]?.taskSpaceName,
          });
        }
      }

      // If the first item is root level (sequence 0 or isCreateNewLevel1), link subsequent unparented items to it
      if (list.length > 1 && (list[0].isCreateNewLevel1 || list[0].hierarchyLevelSequence === 0 || list[0].parentTaskId === -1)) {
        const rootName = list[0].name;
        for (let i = 1; i < list.length; i++) {
          if (!list[i].parentTaskId || list[i].parentTaskId === -1) {
            list[i].parentTaskName = list[i].parentTaskName || rootName;
          }
        }
      }

      const resolvedList: any[] = [];
      const allWarnings: string[] = [];
      let overallNeeds: any[] = [];
      let overallSummary: string | undefined;

      for (const d of list) {
        const res = await this.resolveSingleDraft(d, companyId, allowedSpaceIds, currentUser, list, context);
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
      resolved.isProject === true ||
      resolved.type === 'project' ||
      resolved.hierarchyLevelSequence === (rootLevelConfig.sequence ?? 0) ||
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
    let parentDraft =
      batchDrafts &&
      resolved.parentTaskName &&
      batchDrafts.find(
        (other) =>
          other !== draft &&
          other.name &&
          other.name.trim().toLowerCase() === resolved.parentTaskName.trim().toLowerCase(),
      );

    // If no exact match by parentTaskName, check if the batch has an explicit root project (e.g. created via "Create as new Project")
    if (!parentDraft && batchDrafts && batchDrafts.length > 1 && !isExplicitLevel1) {
      parentDraft = batchDrafts.find(
        (other) =>
          other !== draft &&
          (other.isCreateNewLevel1 ||
           other.parentTaskId === -1 ||
           other.hierarchyLevelSequence === (rootLevelConfig.sequence ?? 0) ||
           (resolved.parentTaskName && other.name && other.name.trim().toLowerCase().includes(resolved.parentTaskName.trim().toLowerCase())) ||
           (resolved.parentTaskName && other.name && resolved.parentTaskName.trim().toLowerCase().includes(other.name.trim().toLowerCase()))),
      );
      if (parentDraft && !resolved.parentTaskName) {
        resolved.parentTaskName = parentDraft.name;
      }
    }

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

    const hasBatchRoot =
      isExplicitLevel1 ||
      Boolean(
        batchDrafts?.some(
          (other) =>
            other.isCreateNewLevel1 ||
            other.parentTaskId === -1 ||
            other.hierarchyLevelSequence === (rootLevelConfig.sequence ?? 0),
        ),
      );

    // If still no parent and not explicit level 1 and not a child of another drafted item, ask user for root container
    if (!resolved.parentTaskId && !isExplicitLevel1 && !isChildOfBatchDraft && !hasBatchRoot) {
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

    // 4. Strict Assignee Scoping to task_space_resources and owners
    if (resolved.assigneeName) {
      const rawAssignee = String(resolved.assigneeName).trim();
      // Fetch resources and owners assigned to this task space
      const spaceWithResources = await this.entityManager.findOne(TaskSpace, {
        where: { id: taskSpace.id },
        relations: ['resources', 'owners'],
      });

      const assignedResources: Resource[] = [...(spaceWithResources?.resources || [])];

      // Also include any space owner who has a Resource record in this company
      if (spaceWithResources?.owners && spaceWithResources.owners.length > 0) {
        const ownerEmails = spaceWithResources.owners.map((o) => o.email).filter(Boolean);
        if (ownerEmails.length > 0) {
          const ownerResources = await this.entityManager
            .createQueryBuilder(Resource, 'resource')
            .where('LOWER(resource.email) IN (:...ownerEmails)', {
              ownerEmails: ownerEmails.map((e) => e.toLowerCase()),
            })
            .getMany();

          for (const or of ownerResources) {
            if (!assignedResources.some((ar) => ar.id === or.id)) {
              assignedResources.push(or);
            }
          }
        }
      }

      const cleanStr = (s?: string) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const q = cleanStr(rawAssignee);
      let matchedResource: Resource | undefined;

      if (q === 'me' && currentUser) {
        const currentEmail = cleanStr(currentUser.email);
        const currentName = cleanStr(currentUser.name);
        matchedResource = assignedResources.find((r) => {
          const rEmail = cleanStr(r.email);
          const rFull = cleanStr(`${r.first_name || ''} ${r.last_name || ''}`);
          return (currentEmail && rEmail === currentEmail) || (currentName && rFull === currentName);
        });
      } else {
        // 1. Exact or substring match with collapsed whitespace
        matchedResource = assignedResources.find((r) => {
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

        // 2. Fuzzy match for minor typos (e.g. "Udra" -> "Udara")
        if (!matchedResource) {
          matchedResource = assignedResources.find((r) => {
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
