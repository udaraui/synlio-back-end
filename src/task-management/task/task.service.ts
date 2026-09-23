import { HttpException, HttpStatus, Injectable, BadRequestException } from '@nestjs/common';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { Between, EntityManager, Equal, In, LessThan, Not, Raw } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TaskSpaceSeverityConfig } from '../task-space-severity-config/task-space-severity-config.entity';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { TaskSpace } from '../task-space/task-space.entity';
import { TaskSpaceHierarchyLevelConfig } from '../task-space-hierarchy-level/task-space-hierarchy-level-config.entity';
import { TmTaskLabel } from '../task-label/task-label.entity';
import { TaskAlertService } from '../task-alert/task-alert.service';
import { User } from '../../user-management/user/user.entity';
import { TaskSpaceStatusConfig } from '../task-space-status-config/task-space-status-config.entity';
import { PostSequenceService } from '../../common/sequence/post-sequence.service';
import { PostType as SequencePostType } from '../../common/sequence/post-sequence.entity';
import { TaskAttachment } from '../task-attachment/task-attachment.entity';
import { Checklist } from '../../common/checklist/checklist.entity';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TmTaskService {
  constructor(
    private entityManager: EntityManager,
    private readonly taskAlertService: TaskAlertService,
    private readonly postSequenceService: PostSequenceService,
    private readonly redisService: RedisService,
  ) { }

  async create(
    data: CreateTaskDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Task[]> {
    return this.entityManager.transaction(async (txManager) => {
      const task = new Task();

      const whereSpace: any = { id: data.taskSpaceId };
      if (activeCompanyId && activeCompanyId !== 0) {
        whereSpace.companyId = activeCompanyId;
      }

      let taskSpace: TaskSpace | null = null;
      if (data.taskSpaceName) {
        taskSpace = {
          name: data.taskSpaceName,
          prefix: data.taskSpacePrefix,
          id: data.taskSpaceId,
          companyId: data.companyId ?? activeCompanyId,
          divisionId: data.divisionId,
        } as TaskSpace;
      }

      if (!taskSpace || !taskSpace.companyId || !taskSpace.prefix) {
        console.log('Fetching TaskSpace from DB in task create', {
          taskSpaceId: data.taskSpaceId,
        });
        taskSpace = await txManager.findOne(TaskSpace, {
          where: whereSpace,
        });
      }
      if (!taskSpace) {
        throw new HttpException(
          'Project space not found',
          HttpStatus.BAD_REQUEST,
        );
      }
      task.taskSpaceId = data.taskSpaceId;
      task.taskSpace = taskSpace;
      // Denormalize task space data
      task.taskSpaceName = taskSpace.name;
      task.taskSpacePrefix = taskSpace.prefix;

      // Security: If not system admin, force the task to the active company
      const targetCompanyId =
        activeCompanyId && activeCompanyId !== 0
          ? activeCompanyId
          : (data.companyId ?? taskSpace.companyId);

      task.companyId = targetCompanyId;
      task.divisionId = data.divisionId ?? taskSpace.divisionId;
      task.name = data.name;
      (task as any).description = data.description ?? null;
      task.special = data.special ?? false;
      task.progressPercentage = data.progressPercentage ?? 0;
      task.estimateEffort = data.estimateEffort ?? 0;
      task.actualEffort = data.actualEffort ?? 0;

      (task as any).startDate = data.startDate
        ? new Date(data.startDate)
        : null;
      (task as any).dueDate = data.dueDate ? new Date(data.dueDate) : null;
      (task as any).completionDate = data.completionDate
        ? new Date(data.completionDate)
        : null;
      (task as any).actualStartDate = data.actualStartDate
        ? new Date(data.actualStartDate)
        : null;
      (task as any).actualEndDate = data.actualEndDate
        ? new Date(data.actualEndDate)
        : null;

      if (data.statusId) {
        let status: TaskSpaceStatusConfig | null = null;
        if ((data as any).status) {
          status = (data as any).status as TaskSpaceStatusConfig;
        } else if (data.statusName && data.statusColor) {
          status = {
            id: data.statusId,
            name: data.statusName,
            color: data.statusColor,
            base: data.statusBase,
          } as unknown as TaskSpaceStatusConfig;
        } else {
          console.log('Fetching Status from DB in task create', {
            statusId: data.statusId,
          });
          status = await txManager.findOne(TaskSpaceStatusConfig, {
            where: { id: data.statusId },
          });
        }
        if (!status)
          throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
        task.status = status;
        task.statusId = data.statusId;
        // Denormalize status data
        task.statusName = status.name;
        task.statusColor = status.color;
        task.statusBase = status.base;
      }

      if (data.severityId) {
        let severity: TaskSpaceSeverityConfig | null = null;
        if (data.severity) {
          severity = data.severity as any;
        } else {
          console.log('Fetching Severity from DB in task create', {
            severityId: data.severityId,
          });
          severity = await txManager.findOne(TaskSpaceSeverityConfig, {
            where: { id: data.severityId },
          });
        }
        if (!severity)
          throw new HttpException('Severity not found', HttpStatus.BAD_REQUEST);
        (task as any).severity = severity;
        task.severityId = data.severityId;
        // Denormalize severity data
        task.severityName = severity.name;
        task.severityColor = severity.color;
      }

      if (data.assigneeId) {
        let assignee: Resource | null = null;
        if (data.assignee) {
          assignee = data.assignee;
        } else {
          console.log('Fetching Assignee from DB in task create', {
            assigneeId: data.assigneeId,
          });
          assignee = await txManager.findOne(Resource, {
            where: { id: data.assigneeId },
          });
        }
        if (!assignee)
          throw new HttpException('Assignee not found', HttpStatus.BAD_REQUEST);
        task.assignee = assignee;
        task.assigneeId = data.assigneeId;
        // Denormalize assignee data
        task.assigneeName =
          `${assignee.first_name} ${assignee.last_name}`.trim();
        task.assigneeProfilePicUrl = assignee.profile_pic;
        task.assigneeEmail = assignee.email;
        task.assigneeSkill = data.assigneeSkill ?? null;
      }

      let levelConfig: TaskSpaceHierarchyLevelConfig | null = null;
      if (data.hierarchyLevelConfigId) {
        if (data.hierarchyLevel) {
          levelConfig = data.hierarchyLevel;
        } else {
          console.log(
            'Fetching Hierarchy Level Config from DB in task create',
            { hierarchyLevelConfigId: data.hierarchyLevelConfigId },
          );
          levelConfig = await txManager.findOne(TaskSpaceHierarchyLevelConfig, {
            where: { id: data.hierarchyLevelConfigId },
          });
        }
        if (!levelConfig)
          throw new HttpException(
            'Hierarchy level config not found',
            HttpStatus.BAD_REQUEST,
          );
        task.hierarchyLevelConfig = levelConfig;
        task.hierarchyLevelConfigId = data.hierarchyLevelConfigId;
        task.hierarchyLevelName = data.hierarchyLevelName ?? levelConfig.name;
        task.hierarchyLevelIcon = data.hierarchyLevelIcon ?? levelConfig.icon;
        task.hierarchyLevelColor =
          data.hierarchyLevelColor ?? levelConfig.color;
        task.hierarchyLevelSequence =
          data.hierarchyLevelSequence ?? levelConfig.sequence;
      } else {
        if (data.hierarchyLevelName !== undefined)
          task.hierarchyLevelName = data.hierarchyLevelName;
        if (data.hierarchyLevelIcon !== undefined)
          task.hierarchyLevelIcon = data.hierarchyLevelIcon;
        if (data.hierarchyLevelColor !== undefined)
          task.hierarchyLevelColor = data.hierarchyLevelColor;
        if (data.hierarchyLevelSequence !== undefined)
          task.hierarchyLevelSequence = data.hierarchyLevelSequence;
      }

      let parentTask: Task | null = null;
      const effectiveParentTaskId =
        data.parentTaskId ?? (data.parentTask as Task)?.id;

      if (effectiveParentTaskId) {
        if (
          data.parentTask &&
          (data.parentTask as Task).id === effectiveParentTaskId &&
          (data.parentTask as Task).code
        ) {
          parentTask = data.parentTask as Task;
        } else {
          console.log('Fetching Parent Task from DB in task create', {
            parentTaskId: effectiveParentTaskId,
          });
          parentTask = await txManager.findOne(Task, {
            where: { id: effectiveParentTaskId, taskSpaceId: taskSpace?.id },
          });
        }
        if (!parentTask) {
          throw new HttpException(
            'Parent task not found',
            HttpStatus.BAD_REQUEST,
          );
        }
        task.parentTask = parentTask;
        task.parentTaskId = parentTask.id as any;
      }

      task.createdBy = authUser?.email as string;
      task.createdAt = new Date();

      if (data.code?.trim()) {
        task.code = data.code.trim();
      } else {
        if (!data.hierarchyLevelConfigId || !levelConfig) {
          throw new HttpException(
            'hierarchyLevelConfigId is required to auto-generate a task code',
            HttpStatus.BAD_REQUEST,
          );
        }
        task.code = (
          await this.getNextTaskCode(
            txManager,
            taskSpace,
            levelConfig,
            parentTask,
          )
        ).code;
      }

      // ── Build the member ID set for root top-level tasks ──────────────────────
      const isRootTopLevel =
        !data.parentTaskId &&
        (data.hierarchyLevelSequence === 0 ||
          (data.hierarchyLevelConfigId && task.hierarchyLevelSequence === 0));

      let memberIds: number[] = [];
      const memberIdSet = new Set<number>();
      
      if (isRootTopLevel) {
        if (data.assigneeId) memberIdSet.add(data.assigneeId);
        data.coAssigneeIds?.forEach((id) => memberIdSet.add(id));
      }
      
      data.memberIds?.forEach((id) => memberIdSet.add(id));

      if (!effectiveParentTaskId && authUser?.email) {
        const isOwner = await txManager.query(
          `SELECT 1 FROM task_space_owners WHERE "taskSpaceId" = $1 AND "userId" IN (SELECT id FROM "user" WHERE email = $2)`,
          [task.taskSpaceId, authUser.email]
        );
        const isResource = await txManager.query(
          `SELECT 1 FROM task_space_resources WHERE "taskSpaceId" = $1 AND "resourceId" IN (SELECT id FROM "resource" WHERE email = $2)`,
          [task.taskSpaceId, authUser.email]
        );

        if (isOwner.length === 0 && isResource.length === 0) {
          const resource = await txManager.query(
            `SELECT id FROM "resource" WHERE email = $1 LIMIT 1`,
            [authUser.email]
          );
          if (resource.length > 0) {
            memberIdSet.add(resource[0].id);
          }
        }
      }

      memberIds = [...memberIdSet];

      // ── Load all ManyToMany relations in parallel ─────────────────────────────
      const [coAssignees, members, labels] = await Promise.all([
        data.coAssigneeIds?.length
          ? data.coAssignees
            ? data.coAssignees
            : (console.log('Fetching Co-Assignees from DB in task create', {
              coAssigneeIds: data.coAssigneeIds,
            }),
              txManager.find(Resource, {
                where: { id: In(data.coAssigneeIds) },
              }))
          : Promise.resolve(null),
        memberIds.length
          ? (() => {
            const memberMap = new Map<number, Resource>();
            if (task.assignee?.id)
              memberMap.set(task.assignee.id, task.assignee);
            if (data.coAssignees)
              data.coAssignees.forEach((co) => {
                if (co.id) memberMap.set(co.id, co);
              });
            if (data.members)
              data.members.forEach((m) => {
                if (m.id) memberMap.set(m.id, m);
              });

            if (memberIds.every((id) => memberMap.has(id))) {
              return Promise.resolve(
                memberIds.map((id) => memberMap.get(id)!),
              );
            }
            console.log('Fetching Members from DB in task create', {
              memberIds,
            });
            return txManager.find(Resource, { where: { id: In(memberIds) } });
          })()
          : Promise.resolve(null),
        data.labelIds?.length
          ? data.labels
            ? Promise.resolve(data.labels)
            : (console.log('Fetching Labels from DB in task create', {
              labelIds: data.labelIds,
            }),
              txManager.find(TmTaskLabel, {
                where: { id: In(data.labelIds) },
              }))
          : Promise.resolve(null),
      ]);

      // ── Assign and save all relations in one shot ─────────────────────────────
      if (coAssignees !== null) {
        task.coAssignees = coAssignees;
      }
      if (members !== null) {
        task.members = members;
      }
      if (labels !== null) {
        task.labels = labels;
      }

      const saved = await txManager.save(Task, task);

      const tasksToReturn: Task[] = [saved];

      if (parentTask) {
        const parentUpdates = await this.rollupParent(
          parentTask,
          authUser,
          txManager,
        );
        if (parentUpdates.length > 0) {
          const updatedParentIds = parentUpdates.map((p) => p.id);
          const updatedParents = await txManager.find(Task, {
            where: { id: In(updatedParentIds) },
          });

          tasksToReturn.push(...updatedParents);
        }
      }

      // Sync members to space for root tasks
      if (memberIds.length > 0) {
        // Run this outside the transaction so it doesn't block, or await it
      }

      // Invalidate visibility caches
      void this.redisService.deleteByPattern(`guest_accessible_tasks:*:space:${taskSpace?.id}`);
      void this.invalidateTaskMembers(saved.id!, memberIds);

      // Fire-and-forget alert
      void this.taskAlertService.dispatchTaskCreated(saved.id!, authUser);

      return tasksToReturn;
    });
  }

  async update(
    id: number,
    data: UpdateTaskDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Task> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, { where });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    const oldParentTaskId = task.parentTaskId; // capture before any changes

    // Capture old snapshot for alert diffing
    const oldSnapshot: Record<string, unknown> = {
      name: task.name,
      description: (task as any).description,
      statusId: task.statusId,
      severityId: task.severityId,
      progressPercentage: task.progressPercentage,
      estimateEffort: task.estimateEffort,
      startDate: task.startDate,
      dueDate: task.dueDate,
    };

    if (data.name !== undefined) task.name = data.name;
    if (data.description !== undefined)
      (task as any).description = data.description ?? null;
    if (data.special !== undefined) task.special = data.special;
    if (data.progressPercentage !== undefined)
      task.progressPercentage = data.progressPercentage;
    if (data.estimateEffort !== undefined)
      task.estimateEffort = data.estimateEffort;
    if (data.actualEffort !== undefined) task.actualEffort = data.actualEffort;

    if (data.startDate !== undefined)
      (task as any).startDate = data.startDate
        ? new Date(data.startDate)
        : null;
    if (data.dueDate !== undefined)
      (task as any).dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.completionDate !== undefined)
      (task as any).completionDate = data.completionDate
        ? new Date(data.completionDate)
        : null;
    if (data.actualStartDate !== undefined)
      (task as any).actualStartDate = data.actualStartDate
        ? new Date(data.actualStartDate)
        : null;
    if (data.actualEndDate !== undefined)
      (task as any).actualEndDate = data.actualEndDate
        ? new Date(data.actualEndDate)
        : null;

    if (data.statusId !== undefined) {
      if (data.statusId === null) {
        (task as any).status = null;
        (task as any).statusId = null;
      } else {
        const status = await this.entityManager.findOne(TaskSpaceStatusConfig, {
          where: { id: data.statusId },
        });
        if (!status)
          throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
        task.status = status;
        task.statusId = data.statusId;
      }
    }

    if (data.severityId !== undefined) {
      if (data.severityId === null) {
        (task as any).severity = null;
        (task as any).severityId = null;
        (task as any).severityName = null;
        (task as any).severityColor = null;
      } else {
        const severity = await this.entityManager.findOne(TaskSpaceSeverityConfig, {
          where: { id: data.severityId },
        });
        if (!severity)
          throw new HttpException('Severity not found', HttpStatus.BAD_REQUEST);
        task.severityId = data.severityId;
        // Denormalize severity data
        task.severityName = severity.name;
        task.severityColor = severity.color;
      }
    }

    if (data.assigneeId !== undefined) {
      if (data.assigneeId === null) {
        (task as any).assignee = null;
        (task as any).assigneeId = null;
        (task as any).assigneeName = null;
        (task as any).assigneeProfilePicUrl = null;
        (task as any).assigneeEmail = null;
        (task as any).assigneeSkill = null;
      } else {
        const assignee = await this.entityManager.findOne(Resource, {
          where: { id: data.assigneeId },
        });
        if (!assignee)
          throw new HttpException('Assignee not found', HttpStatus.BAD_REQUEST);
        task.assignee = assignee;
        task.assigneeId = data.assigneeId;
        // Denormalize assignee data
        task.assigneeName =
          `${assignee.first_name} ${assignee.last_name}`.trim();
        task.assigneeProfilePicUrl = assignee.profile_pic;
        task.assigneeEmail = assignee.email;
        task.assigneeSkill = data.assigneeSkill ?? null;
      }
    }

    if (data.hierarchyLevelConfigId !== undefined) {
      if (data.hierarchyLevelConfigId === null) {
        (task as any).hierarchyLevelConfig = null;
        (task as any).hierarchyLevelConfigId = null;
        (task as any).hierarchyLevelName = null;
        (task as any).hierarchyLevelIcon = null;
        (task as any).hierarchyLevelColor = null;
        (task as any).hierarchyLevelSequence = null;
      } else {
        const levelConfig = await this.entityManager.findOne(
          TaskSpaceHierarchyLevelConfig,
          {
            where: { id: data.hierarchyLevelConfigId },
          },
        );
        if (!levelConfig)
          throw new HttpException(
            'Hierarchy level config not found',
            HttpStatus.BAD_REQUEST,
          );
        task.hierarchyLevelConfig = levelConfig;
        task.hierarchyLevelConfigId = data.hierarchyLevelConfigId;
        // Auto-populate snapshot; allow DTO to override individual fields
        task.hierarchyLevelName = data.hierarchyLevelName ?? levelConfig.name;
        task.hierarchyLevelIcon = data.hierarchyLevelIcon ?? levelConfig.icon;
        task.hierarchyLevelColor =
          data.hierarchyLevelColor ?? levelConfig.color;
        task.hierarchyLevelSequence =
          data.hierarchyLevelSequence ?? levelConfig.sequence;
      }
    } else {
      // Config id not touched – still allow updating the snapshot fields directly
      if (data.hierarchyLevelName !== undefined)
        task.hierarchyLevelName = data.hierarchyLevelName;
      if (data.hierarchyLevelIcon !== undefined)
        task.hierarchyLevelIcon = data.hierarchyLevelIcon;
      if (data.hierarchyLevelColor !== undefined)
        task.hierarchyLevelColor = data.hierarchyLevelColor;
      if (data.hierarchyLevelSequence !== undefined)
        task.hierarchyLevelSequence = data.hierarchyLevelSequence;
    }

    if (data.parentTaskId !== undefined) {
      if (data.parentTaskId === null) {
        (task as any).parentTask = null;
        (task as any).parentTaskId = null;
      } else {
        if (+data.parentTaskId === id) {
          throw new HttpException(
            'Task cannot be its own parent',
            HttpStatus.BAD_REQUEST,
          );
        }
        const parentTask = await this.entityManager.findOne(Task, {
          where: { id: data.parentTaskId },
        });
        if (!parentTask)
          throw new HttpException(
            'Parent task not found',
            HttpStatus.BAD_REQUEST,
          );
        task.parentTask = parentTask;
        task.parentTaskId = data.parentTaskId;
      }
    }

    if (data.taskSpaceId !== undefined) {
      const taskSpace = await this.entityManager.findOne(TaskSpace, {
        where: { id: data.taskSpaceId },
      });
      if (!taskSpace)
        throw new HttpException(
          'Project space not found',
          HttpStatus.BAD_REQUEST,
        );
      task.taskSpace = taskSpace;
      task.taskSpaceId = data.taskSpaceId;
      // Denormalize task space data
      task.taskSpaceName = taskSpace.name;
      task.taskSpacePrefix = taskSpace.prefix;
    }

    task.updatedBy = authUser?.email as string;
    task.updatedAt = new Date();

    await this.entityManager.save(Task, task);

    if (data.coAssigneeIds !== undefined) {
      task.coAssignees = data.coAssigneeIds.length
        ? await this.entityManager.find(Resource, {
          where: { id: In(data.coAssigneeIds) },
        })
        : [];
      await this.entityManager.save(Task, task);
    }

    if (data.memberIds !== undefined) {
      task.members = data.memberIds.length
        ? await this.entityManager.find(Resource, {
          where: { id: In(data.memberIds) },
        })
        : [];
      await this.entityManager.save(Task, task);
    }

    if (data.labelIds !== undefined) {
      task.labels = data.labelIds.length
        ? await this.entityManager.find(TmTaskLabel, {
          where: { id: In(data.labelIds) },
        })
        : [];
      await this.entityManager.save(Task, task);
    }

    // Roll up dates and status to parent(s)
    const newParentTaskId = task.parentTaskId ?? null;
    if (newParentTaskId) {
      await this.rollupParent(newParentTaskId, authUser);
    }
    if (oldParentTaskId && oldParentTaskId !== newParentTaskId) {
      await this.rollupParent(oldParentTaskId, authUser);
    }

    // Invalidate visibility caches
    void this.redisService.deleteByPattern(`guest_accessible_tasks:*:space:${task.taskSpaceId}`);
    void this.invalidateTaskMembers(id);

    // Fire-and-forget alert
    void this.taskAlertService.dispatchTaskUpdated(
      id,
      data as Record<string, unknown>,
      oldSnapshot,
      authUser,
    );

    return this.getTaskById(id);
  }

  async getTaskBaseById(
    id: number,
    activeCompanyId?: number,
  ): Promise<
    Task & { createdByName?: string | null; updatedByName?: string | null }
  > {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['taskSpace', 'labels', 'hierarchyLevelConfig'],
    });

    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const emails = [task.createdBy, task.updatedBy].filter(
      (e): e is string => !!e,
    );
    const userMap: Record<string, string> = {};
    if (emails.length > 0) {
      const users = await this.entityManager.find(User, {
        where: { email: In(emails) },
        select: ['email', 'first_name', 'last_name'],
      });
      users.forEach((u) => {
        userMap[u.email] = `${u.first_name} ${u.last_name}`.trim();
      });
    }

    return Object.assign(task, {
      createdBy: task.createdBy
        ? (userMap[task.createdBy] ?? task.createdBy)
        : null,
      updatedBy: task.updatedBy
        ? (userMap[task.updatedBy] ?? task.updatedBy)
        : null,
    });
  }

  async getTaskAssignees(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ assignee: any; coAssignees: any[]; members: any[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['assignee', 'coAssignees', 'members'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return {
      assignee: task.assignee
        ? { ...task.assignee, assigneeSkill: task.assigneeSkill ?? null }
        : null,
      coAssignees: task.coAssignees ?? [],
      members: task.members ?? [],
    };
  }

  async getTaskChildTasks(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ childTasks: Task[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['childTasks'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return { childTasks: task.childTasks ?? [] };
  }

  async getTaskAttachments(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ taskAttachments: any[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['taskAttachments'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return { taskAttachments: task.taskAttachments ?? [] };
  }

  async getTaskChecklists(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ taskChecklists: any[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    // Checklists live in the shared polymorphic table, so they are fetched
    // separately rather than through a relation.
    const task = await this.entityManager.findOne(Task, { where });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const taskChecklists = await this.entityManager.find(Checklist, {
      where: { entityType: 'Task', entityId: id },
      order: { createdAt: 'ASC' },
    });
    return { taskChecklists };
  }

  async getTaskEvents(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ taskEvents: any[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['taskEvents'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    const sorted = [...(task.taskEvents ?? [])].sort(
      (a: any, b: any) =>
        new Date(b.occurredAt as string).getTime() -
        new Date(a.occurredAt as string).getTime(),
    );
    return { taskEvents: sorted };
  }

  async getTaskById(
    id: number,
    activeCompanyId?: number,
  ): Promise<
    Task & { createdByName?: string | null; updatedByName?: string | null }
  > {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: [
        'taskSpace',
        'status',
        'severity',
        'assignee',
        'coAssignees',
        'members',
        'parentTask',
        'childTasks',
        'taskAttachments',
        'taskEvents',
        'hierarchyLevelConfig',
        'labels',
      ],
    });

    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const emails = [task.createdBy, task.updatedBy].filter(
      (e): e is string => !!e,
    );
    const userMap: Record<string, string> = {};
    if (emails.length > 0) {
      const users = await this.entityManager.find(User, {
        where: { email: In(emails) },
        select: ['email', 'first_name', 'last_name'],
      });
      users.forEach((u) => {
        userMap[u.email] = `${u.first_name} ${u.last_name}`.trim();
      });
    }

    return Object.assign(task, {
      createdBy: task.createdBy
        ? (userMap[task.createdBy] ?? task.createdBy)
        : null,
      updatedBy: task.updatedBy
        ? (userMap[task.updatedBy] ?? task.updatedBy)
        : null,
    });
  }

  async delete(
    id: number,
    authUser?: any,
    activeCompanyId?: number,
  ): Promise<{ message: string }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, { where });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    const parentTaskId = task.parentTaskId; // capture before delete

    const childCount = await this.entityManager.count(Task, {
      where: { parentTaskId: id },
    });
    if (childCount > 0) {
      throw new HttpException(
        `Cannot delete this task. It has ${childCount} child task${childCount > 1 ? 's' : ''}. Please delete all children first.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Preload relations needed by the alert BEFORE deletion
    const preloadedTask = await this.entityManager.findOne(Task, {
      where: { id },
      relations: [
        'taskSpace',
        'status',
        'severity',
        'assignee',
        'coAssignees',
        'members',
      ],
    });

    // Clear many-to-many relations
    await this.entityManager.query(
      `DELETE FROM tm_task_co_assignees WHERE "taskId" = $1`,
      [id],
    );
    await this.entityManager.query(
      `DELETE FROM tm_task_members WHERE "taskId" = $1`,
      [id],
    );
    await this.entityManager.query(
      `DELETE FROM tm_task_labels_mapping WHERE "taskId" = $1`,
      [id],
    );

    // Checklists live in the shared polymorphic table, so there is no FK
    // cascade to rely on — remove them explicitly.
    await this.entityManager.delete(Checklist, {
      entityType: 'Task',
      entityId: id,
    });

    await this.entityManager.delete(Task, { id });

    // Decrease sequence if it was the maximum
    const match = task.code.match(/-([A-Z]+)\d+$/);
    const levelPrefix = match ? match[1] : null;
    await this.postSequenceService.reduceSequenceIfMaximum(
      this.entityManager,
      task.companyId,
      task.taskSpaceId,
      SequencePostType.TSK,
      levelPrefix,
      task.code,
      parentTaskId,
    );

    // Re-calculate parent dates and status now that this child is gone
    if (parentTaskId) {
      await this.rollupParent(parentTaskId, authUser);
    }

    // Invalidate visibility caches
    void this.redisService.deleteByPattern(`guest_accessible_tasks:*:space:${task.taskSpaceId}`);
    
    // Invalidate caches for all members that were on the task before it was deleted
    const oldMemberIds = (preloadedTask?.members?.map(m => m.id).filter(id => id !== undefined) as number[]) || [];
    void this.invalidateTaskMembers(id, oldMemberIds);
    void this.redisService.invalidateUserTaskSpacesByEmail(authUser.email);

    // Fire-and-forget alert (task is already deleted — use preloaded snapshot)
    if (preloadedTask) {
      void this.taskAlertService.dispatchTaskDeleted(
        id,
        authUser,
        preloadedTask,
      );
      void this.taskAlertService.cleanupTaskAlerts(id);
    }

    return { message: 'Task deleted' };
  }

  async patchName(
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

    const result = await this.entityManager.update(Task, where, {
      name,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Fire-and-forget alert (oldName supplied by caller — no extra DB read needed)
    void this.taskAlertService.dispatchNameChanged(
      id,
      oldName ?? name,
      authUser,
    );

    return { id, name, updatedAt: now, updatedBy: authUser?.email as string };
  }

  async patchStatus(
    id: number,
    statusId: number | null,
    oldStatusId: number | null,
    parentTaskId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    statusId: number | null;
    status: TaskSpaceStatusConfig | null;
    updatedAt: Date;
    updatedBy: string;
  }> {
    let resolvedStatus: TaskSpaceStatusConfig | null = null;
    if (statusId !== null) {
      const whereStatus: any = { id: statusId };

      resolvedStatus = await this.entityManager.findOne(TaskSpaceStatusConfig, {
        where: whereStatus,
      });
      if (!resolvedStatus)
        throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
    }
    const now = new Date();
    const whereTask: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereTask.companyId = activeCompanyId;
    }

    let progressPercentage: number | undefined;
    if (resolvedStatus?.base === StatusBaseEnum.FINISHED) {
      progressPercentage = 100;
    } else if (resolvedStatus?.base === StatusBaseEnum.PROCESSING) {
      progressPercentage = 20;
    } else if (resolvedStatus?.base === StatusBaseEnum.TOSTART) {
      progressPercentage = 0;
    }

    const updatePayload: any = {
      statusId: statusId as any,
      statusName: (resolvedStatus?.name ?? null) as any,
      statusColor: (resolvedStatus?.color ?? null) as any,
      statusBase: (resolvedStatus?.base ?? null) as any,
      ...(progressPercentage !== undefined && { progressPercentage }),
      updatedBy: authUser?.email as string,
      updatedAt: now,
    };

    const result = await this.entityManager.update(
      Task,
      whereTask,
      updatePayload,
    );
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Roll up status to all ancestors — always fetch parentTaskId from DB so
    // this works correctly even when the caller omits or mis-supplies it.
    try {
      const taskForRollup = await this.entityManager.findOne(Task, {
        where: { id },
        select: ['id', 'parentTaskId'],
      });
      if (taskForRollup?.parentTaskId) {
        void this.rollupParent(taskForRollup.parentTaskId, authUser);
      }
    } catch (rollupErr) {
      console.error(
        '[StatusRollup] Failed to fetch task for status rollup:',
        rollupErr,
      );
    }

    // Fire-and-forget alert (oldStatusId supplied by caller — no extra DB read)
    void this.taskAlertService.dispatchStatusChanged(id, oldStatusId, authUser);

    return {
      id,
      statusId,
      status: resolvedStatus,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchSeverity(
    id: number,
    severityId: number | null,
    oldSeverityId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    severityId: number | null;
    severity: TaskSpaceSeverityConfig | null;
    updatedAt: Date;
    updatedBy: string;
  }> {
    let resolvedSeverity: TaskSpaceSeverityConfig | null = null;
    if (severityId !== null) {
      const whereSeverity: any = { id: severityId };

      resolvedSeverity = await this.entityManager.findOne(TaskSpaceSeverityConfig, {
        where: whereSeverity,
      });
      if (!resolvedSeverity)
        throw new HttpException('Severity not found', HttpStatus.BAD_REQUEST);
    }
    const now = new Date();
    const whereTask: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereTask.companyId = activeCompanyId;
    }

    const result = await this.entityManager.update(Task, whereTask, {
      severityId: severityId as any,
      severityName: (resolvedSeverity?.name ?? null) as any,
      severityColor: (resolvedSeverity?.color ?? null) as any,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Fire-and-forget alert (oldSeverityId supplied by caller — no extra DB read)
    void this.taskAlertService.dispatchSeverityChanged(
      id,
      oldSeverityId,
      authUser,
    );

    return {
      id,
      severityId,
      severity: resolvedSeverity,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchAssignee(
    id: number,
    assigneeId: number | null,
    oldAssigneeId: number | null,
    authUser: any,
    activeCompanyId?: number,
    assigneeSkill?: string | null,
  ): Promise<{
    id: number;
    assigneeId: number | null;
    assignee: (Resource & { assigneeSkill: string | null }) | null;
    assigneeSkill: string | null;
    members: Resource[];
    updatedAt: Date;
    updatedBy: string;
  }> {
    // Load task with members + coAssignees to auto-sync membership
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['members', 'coAssignees'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    let resolvedAssignee: Resource | null = null;
    if (assigneeId !== null) {
      resolvedAssignee = await this.entityManager.findOne(Resource, {
        where: { id: assigneeId },
      });
      if (!resolvedAssignee)
        throw new HttpException('Assignee not found', HttpStatus.BAD_REQUEST);
    }

    const now = new Date();

    // Auto-sync members: only add new assignee, do not remove old assignees
    const memberIdSet = new Set((task.members ?? []).map((m) => m.id));
    if (assigneeId !== null) {
      memberIdSet.add(assigneeId);
    }

    // Update task scalar columns
    await this.entityManager.update(Task, where, {
      assigneeId: assigneeId as any,
      assigneeName: (resolvedAssignee
        ? `${resolvedAssignee.first_name} ${resolvedAssignee.last_name}`.trim()
        : null) as any,
      assigneeProfilePicUrl: (resolvedAssignee?.profile_pic ?? null) as any,
      assigneeEmail: (resolvedAssignee?.email ?? null) as any,
      assigneeSkill: (resolvedAssignee ? assigneeSkill ?? null : null) as any,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });

    // Sync members via raw SQL to avoid TypeORM duplicate-key issues
    await this.entityManager.query(
      `DELETE FROM tm_task_members WHERE "taskId" = $1`,
      [id],
    );
    const memberArr = [...memberIdSet];
    if (memberArr.length > 0) {
      const placeholders = memberArr
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await this.entityManager.query(
        `INSERT INTO tm_task_members ("taskId", "resourceId") VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        [id, ...memberArr],
      );
    }

    task.members = memberArr.length
      ? await this.entityManager.find(Resource, {
        where: { id: In(memberArr as number[]) },
      })
      : [];


    void this.redisService.deleteByPattern(`guest_accessible_tasks:*:space:${task.taskSpaceId}`);
    void this.invalidateTaskMembers(id, memberArr as number[]);

    // Fire-and-forget alert (oldAssigneeId supplied by caller — no extra DB read)
    void this.taskAlertService.dispatchTaskAssigned(
      id,
      oldAssigneeId,
      authUser,
    );

    return {
      id,
      assigneeId,
      assignee: resolvedAssignee
        ? { ...resolvedAssignee, assigneeSkill: assigneeSkill ?? null }
        : null,
      assigneeSkill: resolvedAssignee ? assigneeSkill ?? null : null,
      members: task.members,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchCoAssignees(
    id: number,
    coAssigneeIds: number[],
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    coAssignees: Resource[];
    members: Resource[];
    updatedAt: Date;
    updatedBy: string;
  }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['coAssignees', 'members'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const assigneeId = task.assigneeId ?? null;
    const oldCoAssigneeIdSet = new Set<number>(
      (task.coAssignees ?? []).map((c) => c.id as number),
    );
    const newCoAssigneeIdSet = new Set(coAssigneeIds);

    const resolvedCoAssignees = coAssigneeIds.length
      ? await this.entityManager.find(Resource, {
        where: { id: In(coAssigneeIds) },
      })
      : [];

    // Auto-sync members: only add new co-assignees, do not remove removed ones
    const memberIdSet = new Set((task.members ?? []).map((m) => m.id));
    for (const newId of newCoAssigneeIdSet) {
      memberIdSet.add(newId);
    }

    const now = new Date();

    // Update co-assignees via raw SQL to avoid TypeORM duplicate-key issues
    await this.entityManager.query(
      `DELETE FROM tm_task_co_assignees WHERE "taskId" = $1`,
      [id],
    );
    if (coAssigneeIds.length > 0) {
      const coPlaceholders = coAssigneeIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await this.entityManager.query(
        `INSERT INTO tm_task_co_assignees ("taskId", "resourceId") VALUES ${coPlaceholders} ON CONFLICT DO NOTHING`,
        [id, ...coAssigneeIds],
      );
    }

    // Sync members via raw SQL
    await this.entityManager.query(
      `DELETE FROM tm_task_members WHERE "taskId" = $1`,
      [id],
    );
    const memberArr = [...memberIdSet];
    if (memberArr.length > 0) {
      const memPlaceholders = memberArr
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await this.entityManager.query(
        `INSERT INTO tm_task_members ("taskId", "resourceId") VALUES ${memPlaceholders} ON CONFLICT DO NOTHING`,
        [id, ...memberArr],
      );
    }

    await this.entityManager.update(Task, where, {
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });

    const resolvedMembers = memberArr.length
      ? await this.entityManager.find(Resource, {
        where: { id: In(memberArr as number[]) },
      })
      : [];


    void this.redisService.deleteByPattern(`guest_accessible_tasks:*:space:${task.taskSpaceId}`);
    void this.invalidateTaskMembers(id, memberArr as number[]);

    // Fire-and-forget alert
    void this.taskAlertService.dispatchTaskUpdated(id, {}, {}, authUser);

    return {
      id,
      coAssignees: resolvedCoAssignees,
      members: resolvedMembers,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchLabels(
    id: number,
    labelIds: number[],
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ labels: TmTaskLabel[] }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, {
      where,
      relations: ['labels'],
    });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const labels: TmTaskLabel[] = labelIds.length
      ? await this.entityManager.find(TmTaskLabel, {
        where: { id: In(labelIds) },
      })
      : [];

    // Wipe existing mappings then re-insert — avoids TypeORM save() duplicate-key
    // bug on ManyToMany junction tables with composite PKs.
    await this.entityManager.query(
      `DELETE FROM tm_task_labels_mapping WHERE "taskId" = $1`,
      [id],
    );

    if (labels.length > 0) {
      const valuePlaceholders = labels
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(', ');
      const params = labels.flatMap((l) => [id, l.id]);
      await this.entityManager.query(
        `INSERT INTO tm_task_labels_mapping ("taskId", "labelId") VALUES ${valuePlaceholders}`,
        params,
      );
    }

    await this.entityManager.update(
      Task,
      { id },
      {
        updatedBy: authUser?.email as string,
        updatedAt: new Date(),
      },
    );

    return { labels };
  }

  async patchHierarchyLevel(
    id: number,
    hierarchyLevelConfigId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Task> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, { where });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    if (hierarchyLevelConfigId === null) {
      (task as any).hierarchyLevelConfigId = null;
      (task as any).hierarchyLevelConfig = null;
      (task as any).hierarchyLevelName = null;
      (task as any).hierarchyLevelIcon = null;
      (task as any).hierarchyLevelColor = null;
      (task as any).hierarchyLevelSequence = null;
    } else {
      const levelConfig = await this.entityManager.findOne(
        TaskSpaceHierarchyLevelConfig,
        {
          where: { id: hierarchyLevelConfigId },
        },
      );
      if (!levelConfig)
        throw new HttpException(
          'Hierarchy level config not found',
          HttpStatus.BAD_REQUEST,
        );
      task.hierarchyLevelConfigId = hierarchyLevelConfigId;
      task.hierarchyLevelConfig = levelConfig;
      task.hierarchyLevelName = levelConfig.name;
      task.hierarchyLevelIcon = levelConfig.icon;
      task.hierarchyLevelColor = levelConfig.color;
      task.hierarchyLevelSequence = levelConfig.sequence;
    }
    task.updatedBy = authUser?.email as string;
    task.updatedAt = new Date();
    await this.entityManager.save(Task, task);
    return this.getTaskById(id);
  }

  async patchProgress(
    id: number,
    progressPercentage: number,
    oldProgress: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    progressPercentage: number;
    statusId?: number;
    status?: any;
    updatedAt: Date;
    updatedBy: string;
  }> {
    const now = new Date();
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const task = await this.entityManager.findOne(Task, { where });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const targetBase = progressPercentage === 0 ? StatusBaseEnum.TOSTART 
                     : progressPercentage === 100 ? StatusBaseEnum.FINISHED 
                     : StatusBaseEnum.PROCESSING;

    const targetStatus = await this.entityManager.findOne(TaskSpaceStatusConfig, {
      where: { taskSpaceId: task.taskSpaceId, base: targetBase as any },
      order: { sequence: 'ASC' }
    });

    const updatePayload: any = {
      progressPercentage,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    };
    
    let updatedStatusId: number | undefined;
    if (targetStatus && targetStatus.id !== task.statusId) {
      updatePayload.statusId = targetStatus.id;
      updatedStatusId = targetStatus.id;
    }

    const result = await this.entityManager.update(Task, where, updatePayload);
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Fire-and-forget alert (oldProgress supplied by caller — no extra DB read)
    void this.taskAlertService.dispatchProgressChanged(
      id,
      oldProgress ?? 0,
      progressPercentage,
      authUser,
    );

    if (updatedStatusId) {
      void this.taskAlertService.dispatchStatusChanged(
        id,
        task.statusId,
        authUser,
      );
    }

    return {
      id,
      progressPercentage,
      ...(updatedStatusId && { statusId: updatedStatusId, status: targetStatus }),
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchSpecial(
    id: number,
    special: boolean,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    special: boolean;
    updatedAt: Date;
    updatedBy: string;
  }> {
    const now = new Date();
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const updatedBy = authUser?.email as string;
    const result = await this.entityManager.update(Task, where, {
      special,
      updatedBy,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    return {
      id,
      special,
      updatedAt: now,
      updatedBy,
    };
  }

  async getBulkTaskRelations(
    taskIds: number[],
    activeCompanyId?: number,
  ): Promise<Record<number, any>> {
    if (!taskIds || taskIds.length === 0) {
      return {};
    }

    // 1. Fetch allowed tasks first to get filteredTaskIds and spaceIds
    const tasks = await this.entityManager.find(Task, {
      where:
        activeCompanyId && activeCompanyId !== 0
          ? { id: In(taskIds), companyId: activeCompanyId }
          : { id: In(taskIds) },
      select: ['id', 'taskSpaceId', 'hierarchyLevelSequence', 'parentTaskId'],
    });

    const filteredTaskIds = tasks.map((t) => t.id!);
    if (filteredTaskIds.length === 0) return {};

    const uniqueSpaceIds = [
      ...new Set(tasks.map((t) => t.taskSpaceId).filter(Boolean)),
    ];

    // 2. Fire remaining queries in parallel
    const [
      commentCounts,
      childAggregates,
      membersRows,
      coAssigneesRows,
      labelsRows,
      allLevels,
    ] = await Promise.all([
      // Comment counts
      this.entityManager
        .createQueryBuilder()
        .select('comment.postId', 'taskId')
        .addSelect('COUNT(*)', 'count')
        .from('comment', 'comment')
        .where('comment.postId IN (:...taskIds)', { taskIds: filteredTaskIds })
        .andWhere("comment.postType = 'Task'")
        .groupBy('comment.postId')
        .getRawMany(),
      // Combined child task count and children with dates check
      this.entityManager
        .createQueryBuilder(Task, 'child')
        .select('child.parentTaskId', 'parentTaskId')
        .addSelect('COUNT(child.id)', 'count')
        .addSelect(
          'SUM(CASE WHEN child.startDate IS NOT NULL OR child.dueDate IS NOT NULL THEN 1 ELSE 0 END)',
          'datesCount',
        )
        .where('child.parentTaskId IN (:...taskIds)', {
          taskIds: filteredTaskIds,
        })
        .groupBy('child.parentTaskId')
        .getRawMany(),
      // Members
      this.entityManager
        .createQueryBuilder()
        .select('m.taskId', 'taskId')
        .addSelect('r.id', 'id')
        .addSelect('r.first_name', 'first_name')
        .addSelect('r.last_name', 'last_name')
        .addSelect('r.email', 'email')
        .addSelect('r.profile_pic', 'profile_pic')
        .from('tm_task_members', 'm')
        .leftJoin('resource', 'r', 'r.id = m."resourceId"')
        .where('m.taskId IN (:...taskIds)', { taskIds: filteredTaskIds })
        .getRawMany(),
      // Co-Assignees
      this.entityManager
        .createQueryBuilder()
        .select('ca.taskId', 'taskId')
        .addSelect('r.id', 'id')
        .addSelect('r.first_name', 'first_name')
        .addSelect('r.last_name', 'last_name')
        .addSelect('r.email', 'email')
        .addSelect('r.profile_pic', 'profile_pic')
        .from('tm_task_co_assignees', 'ca')
        .leftJoin('resource', 'r', 'r.id = ca."resourceId"')
        .where('ca.taskId IN (:...taskIds)', { taskIds: filteredTaskIds })
        .getRawMany(),
      // Labels
      this.entityManager
        .createQueryBuilder()
        .select('tlm.taskId', 'taskId')
        .addSelect('l.id', 'id')
        .addSelect('l.name', 'name')
        .from('tm_task_labels_mapping', 'tlm')
        .leftJoin('tm_task_label', 'l', 'l.id = tlm."labelId"')
        .where('tlm.taskId IN (:...taskIds)', { taskIds: filteredTaskIds })
        .getRawMany(),
      // Fetch space hierarchy levels
      uniqueSpaceIds.length > 0
        ? this.entityManager.find(TaskSpaceHierarchyLevelConfig, {
            where: { taskSpaceId: In(uniqueSpaceIds) },
            select: ['taskSpaceId', 'sequence', 'name'],
          })
        : Promise.resolve([]),
    ]);

    // 3. Build lookup maps
    const commentCountMap: Record<number, number> = {};
    for (const row of commentCounts) {
      if (row.taskId) {
        commentCountMap[row.taskId] = parseInt(row.count, 10) || 0;
      }
    }

    const childTaskCountMap: Record<number, number> = {};
    const childrenHaveDatesSet = new Set<number>();
    for (const row of childAggregates) {
      if (row.parentTaskId) {
        childTaskCountMap[row.parentTaskId] = parseInt(row.count, 10) || 0;
        if (parseInt(row.datesCount, 10) > 0) {
          childrenHaveDatesSet.add(Number(row.parentTaskId));
        }
      }
    }

    const membersMap: Record<number, any[]> = {};
    const coAssigneesMap: Record<number, any[]> = {};
    const labelsMap: Record<number, any[]> = {};

    for (const id of filteredTaskIds) {
      membersMap[id] = [];
      coAssigneesMap[id] = [];
      labelsMap[id] = [];
    }

    for (const row of membersRows) {
      const tid = Number(row.taskId);
      if (!tid) continue;
      if (row.id) {
        membersMap[tid].push({
          id: Number(row.id),
          first_name: row.first_name ?? '',
          last_name: row.last_name ?? '',
          email: row.email ?? '',
          profile_pic: row.profile_pic ?? null,
        });
      }
    }

    for (const row of coAssigneesRows) {
      const tid = Number(row.taskId);
      if (!tid) continue;
      if (row.id) {
        coAssigneesMap[tid].push({
          id: Number(row.id),
          first_name: row.first_name ?? '',
          last_name: row.last_name ?? '',
          email: row.email ?? '',
          profile_pic: row.profile_pic ?? null,
        });
      }
    }

    for (const row of labelsRows) {
      const tid = Number(row.taskId);
      if (!tid) continue;
      if (row.id) {
        labelsMap[tid].push({
          id: Number(row.id),
          name: row.name ?? '',
        });
      }
    }

    // Build per-space sorted level lists
    const levelsPerSpace: Record<number, { sequence: number; name: string }[]> =
      {};
    for (const level of allLevels) {
      if (!levelsPerSpace[level.taskSpaceId]) {
        levelsPerSpace[level.taskSpaceId] = [];
      }
      levelsPerSpace[level.taskSpaceId].push({
        sequence: level.sequence,
        name: level.name,
      });
    }
    for (const levels of Object.values(levelsPerSpace)) {
      levels.sort((a, b) => a.sequence - b.sequence);
    }

    // 4. Construct final result
    const result: Record<number, any> = {};
    for (const task of tasks) {
      if (!task.id) continue;

      const spaceLevels = task.taskSpaceId
        ? levelsPerSpace[task.taskSpaceId] ?? []
        : [];

      const currentIdx =
        task.hierarchyLevelSequence !== null &&
        task.hierarchyLevelSequence !== undefined
          ? spaceLevels.findIndex(
              (l) => l.sequence === task.hierarchyLevelSequence,
            )
          : -1;

      const nextLevelData =
        currentIdx >= 0 && currentIdx + 1 < spaceLevels.length
          ? spaceLevels[currentIdx + 1]
          : null;

      result[task.id] = {
        commentCount: commentCountMap[task.id] || 0,
        childTaskCount: childTaskCountMap[task.id] || 0,
        childrenHaveDates: childrenHaveDatesSet.has(task.id),
        nextLevelName: nextLevelData?.name ?? null,
        members: membersMap[task.id] ?? [],
        coAssignees: coAssigneesMap[task.id] ?? [],
        labels: labelsMap[task.id] ?? [],
      };
    }

    return result;
  }

  async patchDates(
    id: number,
    startDate: string | null,
    dueDate: string | null,
    oldStartDate: string | null,
    oldDueDate: string | null,
    parentTaskId: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    startDate: Date | null;
    dueDate: Date | null;
    updatedAt: Date;
    updatedBy: string;
    /** All ancestor levels that were re-computed, ordered nearest → farthest. */
    parentUpdates: Array<{
      id: number;
      startDate: string | null;
      dueDate: string | null;
    }>;
  }> {
    const now = new Date();
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const newStartDate = startDate ? new Date(startDate) : null;
    const newDueDate = dueDate ? new Date(dueDate) : null;
    const result = await this.entityManager.update(Task, where, {
      startDate: newStartDate as any,
      dueDate: newDueDate as any,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const parentUpdates = parentTaskId
      ? await this.rollupParent(parentTaskId, authUser)
      : [];

    // Fire-and-forget alert (old dates supplied by caller — no extra DB read)
    void this.taskAlertService.dispatchDatesChanged(
      id,
      oldStartDate,
      oldDueDate,
      startDate,
      dueDate,
      authUser,
    );

    return {
      id,
      startDate: newStartDate,
      dueDate: newDueDate,
      updatedAt: now,
      updatedBy: authUser?.email as string,
      parentUpdates,
    };
  }

  async patchDescription(
    id: number,
    description: string | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    description: string | null;
    updatedAt: Date;
    updatedBy: string;
  }> {
    // Capture old value for alert diff
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existing = await this.entityManager.findOne(Task, { where });
    const oldDescription = (existing as any)?.description ?? null;

    const now = new Date();
    const result = await this.entityManager.update(Task, where, {
      description: description as any,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Fire-and-forget alert
    void this.taskAlertService.dispatchTaskUpdated(
      id,
      { description },
      { description: oldDescription },
      authUser,
    );

    return {
      id,
      description,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchActualDates(
    id: number,
    actualStartDate: string | null,
    actualEndDate: string | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    actualStartDate: Date | null;
    actualEndDate: Date | null;
    updatedAt: Date;
    updatedBy: string;
  }> {
    // Capture old values for alert diff
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existing = await this.entityManager.findOne(Task, { where });
    const oldActualStart = (existing as any)?.actualStartDate ?? null;
    const oldActualEnd = (existing as any)?.actualEndDate ?? null;

    const now = new Date();
    const newActualStart = actualStartDate ? new Date(actualStartDate) : null;
    const newActualEnd = actualEndDate ? new Date(actualEndDate) : null;
    const result = await this.entityManager.update(Task, where, {
      actualStartDate: newActualStart as any,
      actualEndDate: newActualEnd as any,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Fire-and-forget alert
    void this.taskAlertService.dispatchTaskUpdated(
      id,
      { actualStartDate, actualEndDate },
      { actualStartDate: oldActualStart, actualEndDate: oldActualEnd },
      authUser,
    );

    return {
      id,
      actualStartDate: newActualStart,
      actualEndDate: newActualEnd,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async patchEffort(
    id: number,
    estimateEffort: number | null,
    actualEffort: number | null,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    estimateEffort: number | null;
    actualEffort: number | null;
    updatedAt: Date;
    updatedBy: string;
    parentUpdates?: Array<{
      id: number;
      startDate: string | null;
      dueDate: string | null;
      estimateEffort: number;
      actualEffort: number;
    }>;
  }> {
    // Capture old values for alert diff
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existing = await this.entityManager.findOne(Task, { where });
    if (!existing) {
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    }
    const oldEstimateEffort = existing.estimateEffort ?? null;
    const oldActualEffort = existing.actualEffort ?? null;
    const parentTaskId = existing.parentTaskId ?? null;

    const now = new Date();
    // Frontend always sends both current values — update both directly, no entity load needed
    // fallback to 0 to satisfy the NOT NULL constraint on both columns
    const result = await this.entityManager.update(Task, where, {
      estimateEffort: (estimateEffort ?? 0) as any,
      actualEffort: (actualEffort ?? 0) as any,
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });
    if (!result.affected)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Roll up effort to parent(s) if applicable
    const parentUpdates = parentTaskId
      ? await this.rollupParent(parentTaskId, authUser)
      : [];

    // Fire-and-forget alert
    void this.taskAlertService.dispatchTaskUpdated(
      id,
      { estimateEffort, actualEffort },
      { estimateEffort: oldEstimateEffort, actualEffort: oldActualEffort },
      authUser,
    );

    return {
      id,
      estimateEffort: estimateEffort ?? 0,
      actualEffort: actualEffort ?? 0,
      updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updatedBy: authUser?.email as string,
      parentUpdates,
    };
  }

  async patchMembers(
    id: number,
    memberIds: number[],
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{
    id: number;
    members: Resource[];
    updatedAt: Date;
    updatedBy: string;
  }> {
    // Verify task exists
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const exists = await this.entityManager.findOne(Task, { where });
    if (!exists)
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    // Deduplicate incoming IDs to guard against client-side duplicates
    const dedupedIds = [
      ...new Set(memberIds.filter((n) => typeof n === 'number' && !isNaN(n))),
    ];

    // Capture old members before deleting them so we can invalidate their cache
    const oldMembersQuery = await this.entityManager.query(
      `SELECT "resourceId" FROM tm_task_members WHERE "taskId" = $1`,
      [id],
    );
    const oldMemberIds = oldMembersQuery.map((row: any) => row.resourceId);

    // --- Guest Member Removal Validation for Root Tasks ---
    if (!exists.parentTaskId) {
      const removedMemberIds = oldMemberIds.filter((oldId: number) => !dedupedIds.includes(oldId));

      if (removedMemberIds.length > 0) {
        const descendants = await this.entityManager.query(
          `WITH RECURSIVE task_hierarchy AS (
             SELECT id FROM tm_task WHERE id = $1
             UNION
             SELECT t.id FROM tm_task t
             INNER JOIN task_hierarchy th ON t."parentTaskId" = th.id
           )
           SELECT id FROM task_hierarchy`,
          [id]
        );
        const descendantIds = descendants.map((row: any) => row.id);

        if (descendantIds.length > 0) {
          for (const removedId of removedMemberIds) {
            const [{ assignCount }] = await this.entityManager.query(
              `SELECT COUNT(*) as "assignCount" FROM tm_task WHERE id = ANY($1) AND "assigneeId" = $2`,
              [descendantIds, removedId]
            );
            const [{ coAssignCount }] = await this.entityManager.query(
              `SELECT COUNT(*) as "coAssignCount" FROM tm_task_co_assignees WHERE "taskId" = ANY($1) AND "resourceId" = $2`,
              [descendantIds, removedId]
            );

            if (parseInt(assignCount, 10) > 0 || parseInt(coAssignCount, 10) > 0) {
              const resource = await this.entityManager.findOne(Resource, { where: { id: removedId } });
              throw new BadRequestException(
                `Cannot remove ${resource?.first_name || 'member'} because they are assigned to this root task or one of its child tasks.`
              );
            }
          }
        }
      }
    }
    // ------------------------------------------------------

    // Use raw SQL for the junction table to avoid TypeORM duplicate-key errors.
    // This is safe because we own both sides of the delete+insert in one request.
    await this.entityManager.query(
      `DELETE FROM tm_task_members WHERE "taskId" = $1`,
      [id],
    );

    if (dedupedIds.length > 0) {
      const placeholders = dedupedIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await this.entityManager.query(
        `INSERT INTO tm_task_members ("taskId", "resourceId") VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        [id, ...dedupedIds],
      );
    }

    const now = new Date();
    await this.entityManager.update(Task, where, {
      updatedBy: authUser?.email as string,
      updatedAt: now,
    });

    const members = dedupedIds.length
      ? await this.entityManager.find(Resource, {
        where: { id: In(dedupedIds) },
      })
      : [];


    void this.redisService.deleteByPattern(`guest_accessible_tasks:*:space:${exists.taskSpaceId}`);
    void this.invalidateTaskMembers(id, [...dedupedIds, ...oldMemberIds]);

    // Fire-and-forget alert
    void this.taskAlertService.dispatchTaskUpdated(id, {}, {}, authUser);

    return {
      id,
      members,
      updatedAt: now,
      updatedBy: authUser?.email as string,
    };
  }

  async rollupParent(
    parentTaskOrId: number | Task,
    authUser?: any,
    txManager: EntityManager = this.entityManager,
  ): Promise<
    Array<{
      id: number;
      startDate: string | null;
      dueDate: string | null;
      estimateEffort: number;
      actualEffort: number;
    }>
  > {
    const startId =
      typeof parentTaskOrId === 'number' ? parentTaskOrId : parentTaskOrId.id;
    if (!startId) return [];

    const updatedBy = (authUser?.email as string) ?? 'system';
    const results: Array<{
      id: number;
      startDate: string | null;
      dueDate: string | null;
      estimateEffort: number;
      actualEffort: number;
    }> = [];

    // Walk up the ancestor chain iteratively (no recursion → safe for deep trees).
    let currentId: number | null = startId;
    while (currentId !== null) {
      const [updatedRows] = await txManager.query(
        `WITH agg AS (
           SELECT
             MIN(c."startDate") AS "minStart",
             MAX(c."dueDate")   AS "maxDue",
             SUM(COALESCE(c."estimateEffort", 0)) AS "sumEstimateEffort",
             SUM(COALESCE(c."actualEffort", 0)) AS "sumActualEffort",
             COUNT(c.id)        AS "totalChildren",
             SUM(CASE WHEN s.base::varchar = $2 THEN 1 ELSE 0 END) AS "processingCount",
             SUM(CASE WHEN s.base::varchar = $3 THEN 1 ELSE 0 END) AS "toStartCount",
             SUM(CASE WHEN s.base::varchar = $4 THEN 1 ELSE 0 END) AS "finishedCount",
             SUM(CASE WHEN s.base IS NOT NULL THEN 1 ELSE 0 END) AS "withBaseCount"
           FROM tm_task c
           LEFT JOIN task_space_status_config s ON s.id = c."statusId"
           WHERE c."parentTaskId" = $1
         ),
         parent_info AS (
           SELECT "parentTaskId", "taskSpaceId"
           FROM tm_task
           WHERE id = $1
         ),
         own_logs AS (
           -- A parent's own work logs are additive on top of the children roll-up
           SELECT COALESCE(SUM(effort), 0) AS "ownLogEffort"
           FROM work_log
           WHERE "postId" = $1 AND "postType"::text = 'Task'
         )
         UPDATE tm_task t
         SET "startDate"   = COALESCE(agg."minStart"::date, t."startDate"),
             "dueDate"     = COALESCE(agg."maxDue"::date, t."dueDate"),
             "estimateEffort" = COALESCE(agg."sumEstimateEffort", 0),
             "actualEffort" = COALESCE(agg."sumActualEffort", 0) + own_logs."ownLogEffort",
             "statusId"    = COALESCE(new_s.id, t."statusId"),
             "statusName"  = COALESCE(new_s.name, t."statusName"),
             "statusColor" = COALESCE(new_s.color, t."statusColor"),
             "statusBase"  = COALESCE(new_s.base::varchar, t."statusBase"),
             "progressPercentage" = CASE COALESCE(new_s.base::varchar, t."statusBase")
                                      WHEN $4 THEN 100
                                      WHEN $2 THEN 20
                                      WHEN $3 THEN 0
                                      ELSE COALESCE(t."progressPercentage", 0)
                                    END,
             "updatedBy"   = $5,
             "updatedAt"   = NOW()
         FROM agg, parent_info, own_logs
         LEFT JOIN LATERAL (
           SELECT id, name, color, base
           FROM task_space_status_config
           WHERE base::varchar = CASE
                          WHEN agg."totalChildren" > 0 AND (agg."processingCount" > 0 OR (agg."finishedCount" > 0 AND agg."finishedCount" < agg."withBaseCount")) THEN $2
                          WHEN agg."totalChildren" > 0 AND agg."toStartCount" > 0 THEN $3
                          WHEN agg."totalChildren" > 0 AND agg."withBaseCount" > 0 AND agg."finishedCount" = agg."withBaseCount" THEN $4
                          ELSE NULL
                        END
             AND "taskSpaceId" = parent_info."taskSpaceId"
             AND "isPrimaryBase" = true
           ORDER BY id ASC
           LIMIT 1
         ) new_s ON true
         WHERE t.id = $1
           AND (
             t."startDate" IS DISTINCT FROM COALESCE(agg."minStart"::date, t."startDate") OR
             t."dueDate" IS DISTINCT FROM COALESCE(agg."maxDue"::date, t."dueDate") OR
             t."estimateEffort" IS DISTINCT FROM COALESCE(agg."sumEstimateEffort", 0) OR
             t."actualEffort" IS DISTINCT FROM COALESCE(agg."sumActualEffort", 0) + own_logs."ownLogEffort" OR
             t."statusId" IS DISTINCT FROM COALESCE(new_s.id, t."statusId") OR
             t."progressPercentage" IS DISTINCT FROM CASE COALESCE(new_s.base::varchar, t."statusBase") WHEN $4 THEN 100 WHEN $2 THEN 20 WHEN $3 THEN 0 ELSE COALESCE(t."progressPercentage", 0) END
           )
         RETURNING 
           t."startDate"::text AS "minStart", 
           t."dueDate"::text AS "maxDue", 
           t."estimateEffort"::numeric AS "estimateEffort",
           t."actualEffort"::numeric AS "actualEffort",
           t."parentTaskId" AS "nextParentId"`,
        [
          currentId,
          StatusBaseEnum.PROCESSING,
          StatusBaseEnum.TOSTART,
          StatusBaseEnum.FINISHED,
          updatedBy,
        ],
      );

      if (updatedRows.length === 0) break;

      const row = updatedRows[0];

      // Collect this level's result (direct parent first, then grandparent, …)
      results.push({
        id: currentId,
        startDate: row.minStart,
        dueDate: row.maxDue,
        estimateEffort: Number(row.estimateEffort) || 0,
        actualEffort: Number(row.actualEffort) || 0,
      });

      currentId = row.nextParentId != null ? Number(row.nextParentId) : null;
    }

    return results;
  }

  async getNextTaskCodeByIds(
    taskSpaceId: number,
    hierarchyLevelConfigId: number,
    parentTaskId: number | null,
    activeCompanyId?: number,
  ): Promise<{ code: string }> {
    const whereSpace: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereSpace.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where: whereSpace,
    });
    if (!taskSpace)
      throw new HttpException(
        `Project space with ID ${taskSpaceId} not found`,
        HttpStatus.BAD_REQUEST,
      );

    const levelConfig = await this.entityManager.findOne(
      TaskSpaceHierarchyLevelConfig,
      {
        where: { id: hierarchyLevelConfigId },
      },
    );
    if (!levelConfig)
      throw new HttpException(
        `Hierarchy level config with ID ${hierarchyLevelConfigId} not found`,
        HttpStatus.BAD_REQUEST,
      );

    let parentTask: Task | null = null;
    if (parentTaskId !== null) {
      const whereParent: any = { id: parentTaskId, taskSpaceId };
      if (activeCompanyId && activeCompanyId !== 0) {
        whereParent.companyId = activeCompanyId;
      }

      parentTask = await this.entityManager.findOne(Task, {
        where: whereParent,
        select: ['id', 'code'],
      });
      if (!parentTask)
        throw new HttpException(
          `Parent task with ID ${parentTaskId} not found`,
          HttpStatus.BAD_REQUEST,
        );
    }

    return this.getNextTaskCode(
      this.entityManager,
      taskSpace,
      levelConfig,
      parentTask,
    );
  }

  async getNextTaskCode(
    txManager: EntityManager,
    taskSpace: TaskSpace,
    levelConfig: TaskSpaceHierarchyLevelConfig,
    parentTask: Task | null,
  ): Promise<{ code: string }> {
    // First letter of the level name is the abbreviation (e.g. "Epic" → "E")
    const levelAbbr = levelConfig.name.charAt(0).toUpperCase();

    if (parentTask === null) {
      // ── Root-level task: PREFIX-E1, PREFIX-E2, … ─────────────────────────
      const spacePrefix = taskSpace.prefix;

      const generated = await this.postSequenceService.generateAndAssignCode(
        txManager,
        taskSpace.companyId,
        taskSpace.id!,
        SequencePostType.TSK,
        levelAbbr,
        levelConfig.sequence,
      );

      return { code: `${spacePrefix}-${generated}` };
    } else {
      // ── Child-level task: PARENT_CODE-F1, PARENT_CODE-F1-S2, … ──────────
      const parentCode = parentTask.code;

      // ── Auto-detect abbreviation from existing siblings ───────────────────
      const existingSiblings: Array<{ code: string }> = await txManager.query(
        `SELECT code FROM tm_task
           WHERE "parentTaskId" = $1
            AND "taskSpaceId" = $2
            AND code ~ '^.+-[A-Z][0-9]+$'
           LIMIT 1`,
        [parentTask.id, taskSpace.id!],
      );

      let effectiveAbbr = levelAbbr;
      if (existingSiblings.length > 0) {
        const sibCode = existingSiblings[0].code;
        const match = sibCode.match(/-([A-Z])\d+$/);
        if (match) effectiveAbbr = match[1];
      }

      const generated = await this.postSequenceService.generateAndAssignCode(
        txManager,
        taskSpace.companyId,
        taskSpace.id!,
        SequencePostType.TSK,
        effectiveAbbr,
        levelConfig.sequence,
        parentTask.id,
      );

      return { code: `${parentCode}-${generated}` };
    }
  }

  async peekNextTaskCodeByIds(
    taskSpaceId: number,
    hierarchyLevelConfigId: number,
    parentTaskId: number | null,
    activeCompanyId?: number,
  ): Promise<{ code: string }> {
    const whereSpace: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereSpace.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where: whereSpace,
    });
    if (!taskSpace)
      throw new HttpException(
        `Project space with ID ${taskSpaceId} not found`,
        HttpStatus.BAD_REQUEST,
      );

    const levelConfig = await this.entityManager.findOne(
      TaskSpaceHierarchyLevelConfig,
      { where: { id: hierarchyLevelConfigId } },
    );
    if (!levelConfig)
      throw new HttpException(
        `Hierarchy level config with ID ${hierarchyLevelConfigId} not found`,
        HttpStatus.BAD_REQUEST,
      );

    let parentTask: Task | null = null;
    if (parentTaskId !== null) {
      const whereParent: any = { id: parentTaskId, taskSpaceId };
      if (activeCompanyId && activeCompanyId !== 0) {
        whereParent.companyId = activeCompanyId;
      }
      parentTask = await this.entityManager.findOne(Task, {
        where: whereParent,
        select: ['id', 'code'],
      });
      if (!parentTask)
        throw new HttpException(
          `Parent task with ID ${parentTaskId} not found`,
          HttpStatus.BAD_REQUEST,
        );
    }

    return this.peekNextTaskCode(taskSpace, levelConfig, parentTask);
  }

  async peekNextTaskCode(
    taskSpace: TaskSpace,
    levelConfig: TaskSpaceHierarchyLevelConfig,
    parentTask: Task | null,
  ): Promise<{ code: string }> {
    const levelAbbr = levelConfig.name.charAt(0).toUpperCase();

    if (parentTask === null) {
      const spacePrefix = taskSpace.prefix;
      const peeked = await this.postSequenceService.peekNextCode(
        this.entityManager,
        taskSpace.companyId,
        taskSpace.id!,
        SequencePostType.TSK,
        levelAbbr,
      );
      return { code: `${spacePrefix}-${peeked}` };
    } else {
      const parentCode = parentTask.code;

      const existingSiblings: Array<{ code: string }> = await this.entityManager.query(
        `SELECT code FROM tm_task
           WHERE "parentTaskId" = $1
            AND "taskSpaceId" = $2
            AND code ~ '^.+-[A-Z][0-9]+$'
           LIMIT 1`,
        [parentTask.id, taskSpace.id!],
      );

      let effectiveAbbr = levelAbbr;
      if (existingSiblings.length > 0) {
        const sibCode = existingSiblings[0].code;
        const match = sibCode.match(/-([A-Z])\d+$/);
        if (match) effectiveAbbr = match[1];
      }

      const peeked = await this.postSequenceService.peekNextCode(
        this.entityManager,
        taskSpace.companyId,
        taskSpace.id!,
        SequencePostType.TSK,
        effectiveAbbr,
        parentTask.id,
      );

      return { code: `${parentCode}-${peeked}` };
    }
  }

  async searchWithStatus(
    param: QueryParam,
    activeCompanyId?: number,
  ): Promise<{ total: number; data: object[] }> {
    let total = 0;
    let data: Task[] = [];

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
      .getRepository(Task)
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
          if (fl.field === 'dueDate') {
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

  async getResourceIdByEmail(
    email: string,
    companyId?: number,
  ): Promise<number | null> {
    const where: any = { email };
    if (companyId && companyId !== 0) where.companyId = companyId;
    const resource = await this.entityManager.findOne(Resource, {
      where,
      select: ['id'],
    });
    return resource?.id ?? null;
  }

  async findMyTasks(
    email: string,
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
    const today = (windowFrom ?? new Date().toISOString()).split('T')[0];
    const baseWhere: any = {
      companyId: activeCompanyId,
      assigneeEmail: email,
      statusBase: Not(StatusBaseEnum.FINISHED),
      id: Raw(
        (alias) =>
          `${alias} NOT IN (SELECT "parentTaskId" FROM tm_task WHERE "parentTaskId" IS NOT NULL)`,
      ),
    };

    if (dates && dates.length > 0) {
      baseWhere.dueDate = In(dates.split(','));
    } else if (fromDate && toDate) {
      baseWhere.dueDate = Between(new Date(fromDate), new Date(toDate));
    }

    const countWhere: any = { ...baseWhere };

    if (tab) {
      if (tab === 'overdue') {
        baseWhere.dueDate = LessThan(today);
      } else if (tab === 'today') {
        baseWhere.dueDate = Equal(today);
      } else if (tab !== 'all') {
        baseWhere.statusName = tab;
      }
    }

    const [total, overdueCount, dueTodayCount, statusCountsResult, data] =
      await Promise.all([
        this.entityManager.count(Task, { where: baseWhere }),
        this.entityManager.count(Task, {
          where: { ...countWhere, dueDate: LessThan(today) },
        }),
        this.entityManager.count(Task, {
          where: { ...countWhere, dueDate: Equal(today) },
        }),
        this.entityManager
          .createQueryBuilder(Task, 'task')
          .select('task.statusName', 'statusName')
          .addSelect('COUNT(task.id)', 'count')
          .where(countWhere)
          .groupBy('task.statusName')
          .getRawMany(),
        this.entityManager.find(Task, {
          where: baseWhere,
          take: rows,
          skip: page * rows,
          order: { dueDate: 'ASC' },
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

  async getMyTaskSpaces(
    email: string,
    activeCompanyId?: number,
    viewAll = false,
  ): Promise<
    {
      id: number;
      name: string;
      prefix: string;
      avgProgress: number;
      taskCount: number;
      rootLevelName: string | null;
      rootLevelIcon: string | null;
      rootLevelColor: string | null;
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
      avgprogress: string;
      taskcount: string;
      rootlevelname: string | null;
      rootlevelicon: string | null;
      rootlevelcolor: string | null;
    }[];

    if (viewAll) {
      // Admin/manager path – return every active space for the company
      rows = await this.entityManager.query(
        `SELECT ts.id, ts.name, ts.prefix,
                COALESCE(AVG(t."progressPercentage"), 0) AS avgprogress,
                COUNT(t.id) AS taskcount,
                hl.name  AS rootlevelname,
                hl.icon  AS rootlevelicon,
                hl.color AS rootlevelcolor
         FROM task_space ts
         LEFT JOIN tm_task t
           ON t."taskSpaceId" = ts.id
           AND t."parentTaskId" IS NULL
         LEFT JOIN LATERAL (
           SELECT name, icon, color
           FROM task_space_hierarchy_level_config
           WHERE "taskSpaceId" = ts.id
           ORDER BY sequence ASC
           LIMIT 1
         ) hl ON true
         WHERE ts."isActive" = true ${companyFilter}
         GROUP BY ts.id, ts.name, ts.prefix, hl.name, hl.icon, hl.color
         ORDER BY ts.id ASC`,
      );
    } else {
      // Member-only path – only spaces where the user is a resource
      const resourceId = await this.getResourceIdByEmail(
        email,
        activeCompanyId,
      );
      if (!resourceId) return [];

      rows = await this.entityManager.query(
        `SELECT ts.id, ts.name, ts.prefix,
                COALESCE(AVG(t."progressPercentage"), 0) AS avgprogress,
                COUNT(t.id) AS taskcount,
                hl.name  AS rootlevelname,
                hl.icon  AS rootlevelicon,
                hl.color AS rootlevelcolor
         FROM task_space ts
         INNER JOIN task_space_resources tsr
           ON tsr."taskSpaceId" = ts.id
           AND tsr."resourceId" = $1
         LEFT JOIN tm_task t
           ON t."taskSpaceId" = ts.id
           AND t."parentTaskId" IS NULL
         LEFT JOIN LATERAL (
           SELECT name, icon, color
           FROM task_space_hierarchy_level_config
           WHERE "taskSpaceId" = ts.id
           ORDER BY sequence ASC
           LIMIT 1
         ) hl ON true
         WHERE ts."isActive" = true ${companyFilter}
         GROUP BY ts.id, ts.name, ts.prefix, hl.name, hl.icon, hl.color
         ORDER BY ts.id ASC`,
        [resourceId],
      );
    }

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      prefix: r.prefix,
      avgProgress: Math.round(Number(r.avgprogress)),
      taskCount: Number(r.taskcount),
      rootLevelName: r.rootlevelname ?? null,
      rootLevelIcon: r.rootlevelicon ?? null,
      rootLevelColor: r.rootlevelcolor ?? null,
    }));
  }

  async getCalendarTaskCounts(
    email: string,
    activeCompanyId?: number,
    from?: string,
    to?: string,
  ): Promise<Record<string, number>> {
    const resourceId = await this.getResourceIdByEmail(email, activeCompanyId);
    if (!resourceId) return {};

    const filters: any[] = [
      { field: 'assigneeId', matchMode: 'equals', value: resourceId },
      {
        field: 'status.base',
        matchMode: 'notEquals',
        value: StatusBaseEnum.FINISHED,
      },
    ];
    if (from && to) {
      filters.push({
        field: 'dueDate',
        matchMode: 'dateBetween',
        value: [from, to],
      });
    }

    const result = await this.searchWithStatus(
      { first: 0, rows: 500, filters, multiSorts: [], withRelations: [] },
      activeCompanyId,
    );

    const counts: Record<string, number> = {};
    for (const task of result.data as any[]) {
      const d = task.dueDate
        ? new Date(task.dueDate as string).toISOString().split('T')[0]
        : null;
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }

  async deleteTaskAttachment(
    id: number,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ message: string }> {
    const attachment = await this.entityManager.findOne(TaskAttachment, {
      where: { id },
      relations: ['task'],
    });
    if (!attachment) throw new HttpException('Attachment not found', HttpStatus.NOT_FOUND);

    if (activeCompanyId && activeCompanyId !== 0) {
      const task = await this.entityManager.findOne(Task, {
        where: { id: attachment.taskId, companyId: activeCompanyId },
        select: ['id'],
      });
      if (!task) throw new HttpException('Attachment not found', HttpStatus.NOT_FOUND);
    }

    await this.entityManager.delete(TaskAttachment, { id });
    return { message: 'Attachment deleted' };
  }

  async createTaskAttachment(
    taskId: number,
    link: string,
    fileName: string | undefined,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<TaskAttachment> {
    const taskWhere: any = { id: taskId };
    if (activeCompanyId && activeCompanyId !== 0) {
      taskWhere.companyId = activeCompanyId;
    }
    const task = await this.entityManager.findOne(Task, { where: taskWhere, select: ['id'] });
    if (!task) throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

    const attachment = new TaskAttachment();
    attachment.taskId = taskId;
    attachment.link = link;
    if (fileName) attachment.fileName = fileName;
    attachment.createdBy = authUser?.email as string;
    attachment.createdAt = new Date();

    return this.entityManager.save(TaskAttachment, attachment);
  }


  private async invalidateTaskMembers(taskId: number, additionalMemberIds: number[] = []) {
    try {
      const queryStr = `
        WITH RECURSIVE Ancestors AS (
          SELECT id, "parentTaskId" FROM tm_task WHERE id = $1
          UNION
          SELECT t.id, t."parentTaskId" FROM tm_task t
          INNER JOIN Ancestors a ON t.id = a."parentTaskId"
        )
        SELECT r.email 
        FROM tm_task_members tm
        INNER JOIN resource r ON tm."resourceId" = r.id
        WHERE tm."taskId" IN (SELECT id FROM Ancestors)
      `;
      const members = await this.entityManager.query(queryStr, [taskId]);
      
      let emails = new Set<string>();
      members.forEach((m: any) => { if (m.email) emails.add(String(m.email).toLowerCase()) });

      if (additionalMemberIds && additionalMemberIds.length > 0) {
        const additional = await this.entityManager.query(`SELECT email FROM resource WHERE id = ANY($1)`, [additionalMemberIds]);
        additional.forEach((m: any) => { if (m.email) emails.add(String(m.email).toLowerCase()) });
      }

      if (emails.size > 0) {
        await this.redisService.invalidateMultipleUsersTaskSpaces(Array.from(emails));
      }
    } catch (e) {
      console.error('Failed to invalidate task members:', e);
    }
  }
}
