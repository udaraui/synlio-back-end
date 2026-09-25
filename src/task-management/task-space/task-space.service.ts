import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Brackets, EntityManager, In } from 'typeorm';
import { TaskSpace } from './task-space.entity';
import { TaskSpaceSeverityConfig } from '../task-space-severity-config/task-space-severity-config.entity';
import { CreateTaskSpaceDto, UpdateTaskSpaceDto } from './dto/task-space.dto';
import { TaskSpaceHierarchyLevel } from '../task-space-hierarchy-level/task-space-hierarchy-level.entity';
import { TaskSpaceHierarchyLevelConfig } from '../task-space-hierarchy-level/task-space-hierarchy-level-config.entity';
import { TaskSpaceStatusConfig } from '../task-space-status-config/task-space-status-config.entity';
import {
  AddHierarchyLevelConfigDto,
  UpdateHierarchyLevelConfigDto,
} from '../task-space-hierarchy-level/dto/task-space-hierarchy-level-config.dto';
import { User } from '../../user-management/user/user.entity';
import { Status } from '../../common/status/status.entity';
import { Severity } from '../../common/severity/severity.entity';
import { PostType } from '../../common/enum/post-type.enum';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { SpaceAlertRule } from '../../alert/alert-rule/space-alert-rule.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { Task } from '../task/task.entity';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TaskSpaceService implements OnModuleInit {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly redisService: RedisService,
  ) {}

  // ── Startup seeding ───────────────────────────────────────────────────

  async onModuleInit() {
    if (process.env.NODE_ENV === 'development') {
      console.log('SKIPPING - Redis cache seeding for task spaces in development environment.');
      return;
    }

    try {
      const spaces = await this.entityManager.find(TaskSpace, {
        where: { isActive: true },
        select: ['id'],
      });
      console.log(
        `STARTING - Redis cache seeding for ${spaces.length} task spaces...`,
      );
      for (const space of spaces) {
        await this.seedSingleTaskSpaceCache(space.id!);
      }
      console.log(
        `FINISHED - Redis cache seeding for ${spaces.length} task spaces.`,
      );
      
      await this.seedAllSpaceMemberships();
    } catch (err: any) {
      // Non-fatal — if migrations haven't run yet the tables won't exist
      if ((err as any).code === '42P01') {
        console.warn(
          'task_space table not found yet - skipping startup cache seed.',
        );
      } else {
        console.error(
          'Error seeding task space cache on startup:',
          err,
        );
      }
    }
  }

  // ── Redis cache helpers ────────────────────────────────────────────────

  /** Builds the full flat config blob for a space from the DB. */
  private async buildTaskSpaceConfigBlob(spaceId: number): Promise<object> {
    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where: { id: spaceId },
      relations: [
        'owners',
        'resources',
        'resources.resourceSkills',
        'resources.resourceSkills.skill',
        'statusConfigs',
        'severityConfigs',
        'hierarchyLevelConfigs',
      ],
    });
    if (!taskSpace)
      throw new NotFoundException(`Project space with ID ${spaceId} not found`);

    // const statuses: any[] = await this.entityManager.query(
    //   `SELECT s.id, s.name, s.color, tss.sequence
    //    FROM status s
    //    INNER JOIN task_space_status tss ON s.id = tss."statusId"
    //    WHERE tss."taskSpaceId" = $1
    //    ORDER BY tss.sequence ASC, s.id ASC`,
    //   [spaceId],
    // );

    // const severities: any[] = await this.entityManager.query(
    //   `SELECT sev.id, sev.name, sev.color
    //    FROM severity sev
    //    INNER JOIN task_space_severity tss ON sev.id = tss."severityId"
    //    WHERE tss."taskSpaceId" = $1
    //    ORDER BY sev.id ASC`,
    //   [spaceId],
    // );

    // const hierarchy = await this.entityManager.find(TaskSpaceHierarchyLevelConfig, {
    //   where: { taskSpaceId: spaceId },
    //   order: { sequence: 'ASC' },
    // });

    return {
      taskSpace: {
        id: taskSpace.id,
        name: taskSpace.name,
        prefix: taskSpace.prefix,
        companyId: taskSpace.companyId,
        divisionId: taskSpace.divisionId,
      },
      status: taskSpace.statusConfigs || [],
      severity: taskSpace.severityConfigs || [],
      hierarchy: taskSpace.hierarchyLevelConfigs || [],
      owners: (taskSpace.owners ?? []).map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        profile_pic: u.profile_picture,
      })),
      members: (taskSpace.resources ?? []).map((r) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        profile_pic: r.profile_pic,
        skills: (r.resourceSkills ?? [])
          .map((rs) => rs.skillName ?? rs.skill?.name)
          .filter((s): s is string => Boolean(s)),
      })),
    };
  }

  /** Reads all space data from DB and writes a single blob to Redis. Non-fatal. */
  async seedSingleTaskSpaceCache(spaceId: number): Promise<void> {
    try {
      const blob = await this.buildTaskSpaceConfigBlob(spaceId);
      await this.redisService.setTaskSpaceConfig(spaceId, blob);
    } catch (err) {
      console.error(
        `[TaskSpaceService] Failed to seed Redis cache for task space ${spaceId}:`,
        err,
      );
    }
  }

  getAllTaskSpaces(activeCompanyId?: number, accessibleSpaceIds?: number[]) {
    const where: any = { isActive: true };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }
    if (accessibleSpaceIds) {
      where.id = In(accessibleSpaceIds);
    }

    return this.entityManager.find(TaskSpace, {
      where,
      order: { id: 'asc' },
      relations: ['company', 'division', 'hierarchyLevelConfigs', 'owners'],
    });
  }

  async getTaskSpaceById(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: ['company', 'division', 'hierarchyLevelConfigs', 'owners'],
    });

    if (!taskSpace) {
      throw new NotFoundException(`Project space with ID ${id} not found`);
    }

    return taskSpace;
  }

  getAllTaskSpacesByCompanyId(companyId: number, accessibleSpaceIds?: number[]) {
    const where: any = { companyId, isActive: true };
    if (accessibleSpaceIds) {
      where.id = In(accessibleSpaceIds);
    }

    return this.entityManager.find(TaskSpace, {
      where,
      order: { id: 'asc' },
      relations: ['company', 'division', 'hierarchyLevelConfigs', 'owners'],
    });
  }

  async checkPrefixExists(
    companyId: number,
    prefix: string,
  ): Promise<{ exists: boolean }> {
    const existing = await this.entityManager.findOne(TaskSpace, {
      where: { companyId, prefix: prefix.toUpperCase() },
    });
    return { exists: !!existing };
  }

  // ── Default seed helpers ───────────────────────────────────────────

  private async seedDefaultTaskSpaceConfigs(
    spaceId: number,
    companyId: number,
    email: string,
    em?: EntityManager,
  ) {
    const mgr = em ?? this.entityManager;
    // Statuses — fetch only the primary base statuses (should be exactly 3: To Start, In Progress, Done)
    const statuses = await mgr.find(Status, {
      where: { postType: PostType.TSK, isPrimaryBase: true },
      order: { id: 'ASC' },
    });
    for (let i = 0; i < statuses.length; i++) {
      await mgr.query(
        `INSERT INTO task_space_status_config ("taskSpaceId","sequence","name","color","base","isPrimaryBase","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [spaceId, i, statuses[i].name, statuses[i].color, statuses[i].base, statuses[i].isPrimaryBase ?? false],
      );
    }
    // Severities — auto-seed from base severities
    const severities = await mgr.find(Severity, {
      where: { postType: PostType.TSK },
      order: { id: 'ASC' },
      take: 3,
    });
    for (const sev of severities) {
      await mgr.query(
        `INSERT INTO task_space_severity_config ("taskSpaceId","name","color","responseTimeInMinutes","resolutionTimeInMinutes","createdAt","updatedAt","createdBy","updatedBy")
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),$6,$6) ON CONFLICT DO NOTHING`,
        [spaceId, sev.name, sev.color || '#6366f1', 0, 0, email],
      );
    }
    // Hierarchy levels — auto-seed first 5 master levels
    const masterLevels = await mgr.find(TaskSpaceHierarchyLevel, {
      order: { id: 'ASC' },
      take: 5,
    });
    if (masterLevels.length) {
      const configs = masterLevels.map((level, idx) => {
        const config = new TaskSpaceHierarchyLevelConfig();
        config.taskSpaceId = spaceId;
        config.sequence = idx;
        config.name = level.name;
        config.icon = level.icon ?? 'Folder';
        config.color = level.color ?? '#6366f1';
        config.createdBy = email;
        return config;
      });
      await mgr.save(TaskSpaceHierarchyLevelConfig, configs);
    }
  }

  // ── Status / Severity inline-edit ─────────────────────────────────

  async updateSpaceStatus(
    taskSpaceId: number,
    statusId: number,
    dto: { name?: string; color?: string },
    authUser: any,
  ) {
    const config = await this.entityManager.query(
      `SELECT * FROM task_space_status_config WHERE "taskSpaceId"=$1 AND id=$2`,
      [taskSpaceId, statusId],
    );
    if (config.length === 0)
      throw new NotFoundException('Status not found in this project space');

    const updateClauses: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updateClauses.push(`name = $${paramIndex++}`);
      updateValues.push(dto.name);
    }
    if (dto.color !== undefined) {
      updateClauses.push(`color = $${paramIndex++}`);
      updateValues.push(dto.color);
    }
    
    updateClauses.push(`"updatedBy" = $${paramIndex++}`);
    updateValues.push(authUser.email as string);

    if (updateClauses.length > 1) { // >1 because updatedBy is always there
      updateValues.push(taskSpaceId, statusId);
      const [updated] = await this.entityManager.query(
        `UPDATE task_space_status_config SET ${updateClauses.join(', ')}, "updatedAt" = NOW() WHERE "taskSpaceId"=$${paramIndex++} AND id=$${paramIndex++} RETURNING *`,
        updateValues,
      );
      
      // Update all tasks in this space using this status
      await this.entityManager.query(
        `UPDATE tm_task SET "statusName" = $1, "statusColor" = $2 WHERE "taskSpaceId" = $3 AND "statusId" = $4`,
        [updated.name, updated.color, taskSpaceId, statusId],
      );
      
      await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
      return updated;
    }
    
    return config[0];
  }

  async updateSpaceSeverity(
    taskSpaceId: number,
    severityId: number,
    dto: { name?: string; color?: string },
    authUser: any,
  ) {
    const config = await this.entityManager.query(
      `SELECT * FROM task_space_severity_config WHERE "taskSpaceId"=$1 AND id=$2`,
      [taskSpaceId, severityId],
    );
    if (config.length === 0)
      throw new NotFoundException('Severity not found in this project space');

    const updateClauses: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updateClauses.push(`name = $${paramIndex++}`);
      updateValues.push(dto.name);
    }
    if (dto.color !== undefined) {
      updateClauses.push(`color = $${paramIndex++}`);
      updateValues.push(dto.color);
    }
    
    updateClauses.push(`"updatedBy" = $${paramIndex++}`);
    updateValues.push(authUser.email as string);

    if (updateClauses.length > 1) {
      updateValues.push(taskSpaceId, severityId);
      const [updated] = await this.entityManager.query(
        `UPDATE task_space_severity_config SET ${updateClauses.join(', ')}, "updatedAt" = NOW() WHERE "taskSpaceId"=$${paramIndex++} AND id=$${paramIndex++} RETURNING *`,
        updateValues,
      );
      
      // Update all tasks in this space using this severity
      await this.entityManager.query(
        `UPDATE tm_task SET "severityName" = $1, "severityColor" = $2 WHERE "taskSpaceId" = $3 AND "severityId" = $4`,
        [updated.name, updated.color, taskSpaceId, severityId],
      );
      
      await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
      return updated;
    }

    return config[0];
  }

  async createTaskSpace(
    dto: CreateTaskSpaceDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    // Security: If not system admin, force the space to the active company
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : dto.companyId;

    // ── Core creation — atomic transaction ───────────────────────────────
    const savedSpace = await this.entityManager.transaction(async (em) => {
      const newSpace = new TaskSpace();
      Object.assign(newSpace, {
        name: dto.name,
        prefix: dto.prefix.toUpperCase(),
        description: dto.description,
        companyId: targetCompanyId,
        divisionId: dto.divisionId,
        isActive: true,
      });
      newSpace.createdBy = authUser.email;

      // Build the owner id list, ensuring the creating user is always included
      const ownerIdSet = new Set<number>(dto.ownerIds ?? []);
      if (authUser.userId) {
        ownerIdSet.add(authUser.userId as number);
      }
      if (ownerIdSet.size > 0) {
        newSpace.owners = await em.findBy(User, {
          id: In([...ownerIdSet]),
        });
      }

      return em.save(TaskSpace, newSpace);
    });

    // ── Non-fatal: auto-add creator as resource ───────────────────────────
    // Auto-add the creating user as a resource (matched by email) so they appear
    // in task_space_resources and are shown task spaces when canViewAllSpaces = false.
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const creatorResource = await this.entityManager.findOne(Resource, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        where: { email: authUser.email as string, companyId: dto.companyId },
        select: ['id'],
      });
      if (creatorResource) {
        // Check not already linked (defensive — space is brand new so this won't exist)
        const already = await this.entityManager.query(
          `SELECT 1 FROM task_space_resources WHERE "taskSpaceId" = $1 AND "resourceId" = $2`,
          [savedSpace.id, creatorResource.id],
        );
        if (!(already as any[]).length) {
          await this.entityManager.query(
            `INSERT INTO task_space_resources ("taskSpaceId", "resourceId") VALUES ($1, $2)`,
            [savedSpace.id, creatorResource.id],
          );
        }
      }
    } catch (resourceErr) {
      // Non-fatal — space is still created
      console.error(
        'Failed to auto-add creator as resource to project space:',
        resourceErr,
      );
    }

    // ── Non-fatal: create Default alert rule ─────────────────────────────
    // Auto-create the Default alert rule (mirrors legacy hardcoded behaviour)
    try {
      const defaultRule = this.entityManager.create(SpaceAlertRule, {
        name: 'Default',
        spaceType: 'task',
        spaceId: savedSpace.id!,
        events: [
          'TASK_CREATED',
          'TASK_UPDATED',
          'TASK_ASSIGNED',
          'STATUS_CHANGED',
          'SEVERITY_CHANGED',
          'NAME_CHANGED',
          'COMMENT_ADDED',
          'TASK_DELETED',
          'PROGRESS_CHANGED',
          'DATES_CHANGED',
        ],
        channel: 'inapp',
        toAssignee: true,
        toCoAssignees: true,
        toCreator: true,
        toActor: true,
        toParticipants: false,
        toAdditionalUserIds: [],
        ccAssignee: false,
        ccCoAssignees: false,
        ccParticipants: false,
        ccCreator: false,
        ccActor: false,
        ccAdditionalUserIds: [],
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        createdBy: authUser.email as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        updatedBy: authUser.email as string,
      });
      await this.entityManager.save(SpaceAlertRule, defaultRule);
    } catch (ruleErr) {
      // Don't fail space creation if rule seeding fails
      console.error(
        'Failed to create default alert rule for project space:',
        ruleErr,
      );
    }

    // ── Non-fatal: seed default statuses, severities & hierarchy levels ───
    try {
      await this.seedDefaultTaskSpaceConfigs(
        savedSpace.id!,
        dto.companyId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        authUser.email as string,
      );
    } catch (seedErr) {
      console.error(
        'Failed to seed default configs for project space:',
        seedErr,
      );
    }

    // Seed Redis cache for the new space (after seeding default configs above)
    await this.seedSingleTaskSpaceCache(savedSpace.id!);
    void this.redisService.invalidateUserTaskSpacesByEmail(authUser.email);

    return savedSpace;
  }

  async updateTaskSpace(
    id: number,
    dto: UpdateTaskSpaceDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<TaskSpace> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    let oldOwners: User[] = [];

    const result = await this.entityManager.transaction(async (em) => {
      const existing = await em.findOne(TaskSpace, {
        where,
        relations: ['owners'],
      });
      if (!existing) {
        throw new NotFoundException(`Project Space with ID ${id} not found`);
      }
      
      oldOwners = existing.owners || [];

      if (dto.name !== undefined) existing.name = dto.name;
      if (dto.prefix !== undefined) existing.prefix = dto.prefix.toUpperCase();
      if (dto.description !== undefined) existing.description = dto.description;
      if (dto.companyId !== undefined) existing.companyId = dto.companyId;
      if (dto.divisionId !== undefined) existing.divisionId = dto.divisionId;
      existing.updatedBy = authUser.email;

      if (dto.hierarchyLevelIds !== undefined) {
        // Replace all configs for this space with the new set
        await em.delete(TaskSpaceHierarchyLevelConfig, {
          taskSpaceId: id,
        });
        if (dto.hierarchyLevelIds.length) {
          const masterLevels = await em.findBy(TaskSpaceHierarchyLevel, {
            id: In(dto.hierarchyLevelIds),
          });
          // Preserve the caller-supplied order — findBy with In() returns rows in PK
          // order, NOT in the order of the input array.
          const levelMap = new Map(masterLevels.map((l) => [l.id, l]));
          const orderedLevels = dto.hierarchyLevelIds
            .map((id) => levelMap.get(id))
            .filter((l): l is TaskSpaceHierarchyLevel => l !== undefined);
          const configs = orderedLevels.map((level, idx) => {
            const config = new TaskSpaceHierarchyLevelConfig();
            config.taskSpaceId = id;
            config.sequence = idx;
            config.name = level.name;
            config.icon = level.icon ?? 'Folder';
            config.color = level.color ?? '#6366f1';
            config.createdBy = authUser.email as string;
            return config;
          });
          await em.save(TaskSpaceHierarchyLevelConfig, configs);
        }
      }

      if (dto.ownerIds !== undefined) {
        existing.owners = dto.ownerIds.length
          ? await em.findBy(User, { id: In(dto.ownerIds) })
          : [];
      }

      return em.save(TaskSpace, existing);
    });

    // Invalidate cache — next GET will re-populate lazily
    await this.redisService.deleteTaskSpaceConfig(id);
    
    // Invalidate caches for all old owners (in case they were removed)
    for (const oldOwner of oldOwners) {
      void this.redisService.invalidateUserTaskSpacesByEmail(oldOwner.email);
    }
    
    // Invalidate caches for all current members and owners
    void this.invalidateTaskSpaceMembers(id);
    return result;
  }

  async toggleIsActive(
    id: number,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<{ isActive: boolean; message: string }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace) {
      throw new NotFoundException(`Project Space with ID ${id} not found`);
    }
    taskSpace.isActive = !taskSpace.isActive;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    taskSpace.updatedBy = authUser.email as string;
    await this.entityManager.save(TaskSpace, taskSpace);
    await this.redisService.deleteTaskSpaceConfig(id);
    return {
      isActive: taskSpace.isActive,
      message: `Project space ${taskSpace.isActive ? 'activated' : 'deactivated'}`,
    };
  }

  async deleteTaskSpace(
    id: number,
    activeCompanyId?: number,
  ): Promise<{ message: string }> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });

    if (!taskSpace) {
      throw new NotFoundException(`Project Space with ID ${id} not found`);
    }

    // Prevent deletion if tasks exist under this space
    const tasks = await this.entityManager.find(Task, {
      where: { taskSpaceId: id },
      select: ['id', 'code', 'name'],
      take: 5,
    });

    if (tasks.length > 0) {
      const taskCodes = tasks.map((t) => t.code).join(', ');
      const totalCount = await this.entityManager.count(Task, {
        where: { taskSpaceId: id },
      });

      throw new BadRequestException(
        `Cannot delete project space. This space has ${totalCount} task(s). ` +
          `Tasks: ${taskCodes}${totalCount > 5 ? '...' : ''}. ` +
          `Please delete or move the tasks first`,
      );
    }

    // Fetch and invalidate caches for all current members and owners before deletion
    await this.invalidateTaskSpaceMembers(id);

    await this.entityManager.delete(TaskSpace, id);
    // Remove all cached config for the deleted space
    await this.redisService.deleteTaskSpaceConfig(id);
    return { message: 'Project Space deleted' };
  }

  // ── Status Config ─────────────────────────────────────────────────────

  async getStatusConfig(id: number, companyId: number) {
    const cached = await this.redisService.getTaskSpaceConfig(id);
    let statuses: any[] = [];
    
    if (cached && (cached as any).status) {
      statuses = (cached as any).status;
    } else {
      statuses = await this.entityManager.query(
        `SELECT c.*, c.sequence
         FROM task_space_status_config c
         WHERE c."taskSpaceId" = $1
         ORDER BY c.sequence ASC, c.id ASC`,
        [id],
      );
      if (statuses.length > 0) {
        await this.seedSingleTaskSpaceCache(id);
      }
    }

    if (statuses.length > 0) {
      const statusIds = statuses.map((s) => s.id);
      const counts = await this.entityManager.query(
        `SELECT "statusId", COUNT(*) as count FROM tm_task WHERE "taskSpaceId" = $1 AND "statusId" = ANY($2) GROUP BY "statusId"`,
        [id, statusIds]
      );
      const countMap = new Map(counts.map((c: any) => [c.statusId, parseInt(c.count, 10)]));
      statuses = statuses.map((s) => ({
        ...s,
        taskCount: countMap.get(s.id) || 0,
      }));
      return { statuses, availableStatuses: [] };
    }

    // No configured statuses
    const availableStatuses = await this.entityManager.find(Status, {
      where: { postType: PostType.TSK, isPrimaryBase: true },
      order: { id: 'ASC' },
    });

    return { statuses: [], availableStatuses };
  }

  async addStatusToSpace(
    taskSpaceId: number,
    name: string,
    color: string,
    authUser: any,
    base?: StatusBaseEnum | null,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const status = await this.entityManager.transaction(async (em) => {
      const taskSpace = await em.findOne(TaskSpace, { where });
      if (!taskSpace)
        throw new NotFoundException(
          `Project space with ID ${taskSpaceId} not found`,
        );

      // Guard against duplicate link
      // Check if it's already in the config
      const alreadyLinked = await em.query(
        `SELECT 1 FROM task_space_status_config WHERE "taskSpaceId" = $1 AND name = $2`,
        [taskSpaceId, name],
      );
      if (alreadyLinked.length > 0)
        throw new BadRequestException(
          'Status already added to this project space',
        );

      // Calculate optimal insertion index
      const existingConfigs = await em.query(
        `SELECT id, base, sequence FROM task_space_status_config WHERE "taskSpaceId" = $1 ORDER BY sequence ASC`,
        [taskSpaceId]
      );
      
      const newBase = base ?? 'To Start';
      const baseOrder: Record<string, number> = { 'To Start': 1, 'Processing': 2, 'Finished': 3 };
      const newBaseValue = baseOrder[newBase] || 4;
      
      let insertIndex = existingConfigs.length;
      const lastSameBaseIndex = existingConfigs.map((c: any) => c.base).lastIndexOf(newBase);
      
      if (lastSameBaseIndex !== -1) {
        insertIndex = lastSameBaseIndex + 1;
      } else {
        let found = false;
        for (let i = existingConfigs.length - 1; i >= 0; i--) {
           const existingBaseValue = baseOrder[existingConfigs[i].base] || 4;
           if (existingBaseValue < newBaseValue) {
             insertIndex = i + 1;
             found = true;
             break;
           }
        }
        if (!found) insertIndex = 0;
      }

      const [insertedConfig] = await em.query(
        `INSERT INTO task_space_status_config ("taskSpaceId", "sequence", "name", "color", "base", "isPrimaryBase", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW()) RETURNING *`,
        [taskSpaceId, -1, name, color, newBase],
      );

      existingConfigs.splice(insertIndex, 0, { id: insertedConfig.id });
      for (let i = 0; i < existingConfigs.length; i++) {
        await em.query(
          `UPDATE task_space_status_config SET sequence = $1 WHERE id = $2`,
          [i, existingConfigs[i].id]
        );
      }
      
      insertedConfig.sequence = insertIndex;
      
      return insertedConfig;
    });

    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return status;
  }

  async addExistingStatusToSpace(
    taskSpaceId: number,
    statusId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    // Look up by id only — no companyId filter so master statuses from any
    // company can be assigned to this task space (mirrors the available list).
    const status = await this.entityManager.findOne(Status, {
      where: { id: statusId },
    });
    if (!status)
      throw new NotFoundException(`Status with ID ${statusId} not found`);

    const existing = await this.entityManager.query(
      `SELECT 1 FROM task_space_status_config WHERE "taskSpaceId" = $1 AND name = $2`,
      [taskSpaceId, status.name],
    );
    if (existing.length > 0)
      throw new BadRequestException(
        'Status already added to this project space',
      );

    await this.entityManager.transaction(async (em) => {
      const existingConfigs = await em.query(
        `SELECT id, base, sequence FROM task_space_status_config WHERE "taskSpaceId" = $1 ORDER BY sequence ASC`,
        [taskSpaceId]
      );
      
      const newBase = status.base ?? 'To Start';
      const baseOrder: Record<string, number> = { 'To Start': 1, 'Processing': 2, 'Finished': 3 };
      const newBaseValue = baseOrder[newBase] || 4;
      
      let insertIndex = existingConfigs.length;
      const lastSameBaseIndex = existingConfigs.map((c: any) => c.base).lastIndexOf(newBase);
      
      if (lastSameBaseIndex !== -1) {
        insertIndex = lastSameBaseIndex + 1;
      } else {
        let found = false;
        for (let i = existingConfigs.length - 1; i >= 0; i--) {
           const existingBaseValue = baseOrder[existingConfigs[i].base] || 4;
           if (existingBaseValue < newBaseValue) {
             insertIndex = i + 1;
             found = true;
             break;
           }
        }
        if (!found) insertIndex = 0;
      }

      const [insertedConfig] = await em.query(
        `INSERT INTO task_space_status_config ("taskSpaceId", "sequence", "name", "color", "base", "isPrimaryBase", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
        [taskSpaceId, -1, status.name, status.color, status.base, status.isPrimaryBase ?? false],
      );

      existingConfigs.splice(insertIndex, 0, { id: insertedConfig.id });
      for (let i = 0; i < existingConfigs.length; i++) {
        await em.query(
          `UPDATE task_space_status_config SET sequence = $1 WHERE id = $2`,
          [i, existingConfigs[i].id]
        );
      }
    });
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    return status;
  }

  async removeStatusFromSpace(
    taskSpaceId: number,
    statusId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    // Check if any tasks in this space are using the status
    const [{ count }] = await this.entityManager.query(
      `SELECT COUNT(*) as count FROM tm_task WHERE "taskSpaceId" = $1 AND "statusId" = $2`,
      [taskSpaceId, statusId],
    );
    if (parseInt(count, 10) > 0)
      throw new BadRequestException(
        `Cannot remove this status because it is currently assigned to ${count} task(s) in this space`,
      );

    // Check if it is a primary status
    const [statusConfig] = await this.entityManager.query(
      `SELECT "isPrimaryBase" FROM task_space_status_config WHERE "taskSpaceId" = $1 AND id = $2`,
      [taskSpaceId, statusId],
    );
    if (statusConfig && statusConfig.isPrimaryBase) {
      throw new BadRequestException(`Cannot remove a primary status from the space`);
    }

    await this.entityManager.query(
      `DELETE FROM task_space_status_config WHERE \"taskSpaceId\" = $1 AND id = $2`,
      [taskSpaceId, statusId],
    );
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return { message: 'Status removed' };
  }

  async updateStatusSequence(
    taskSpaceId: number,
    sequences: { statusId: number; sequence: number }[],
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace) throw new NotFoundException('Project space not found');

    await this.entityManager.transaction(async (em) => {
      for (const item of sequences) {
        await em.query(
          `UPDATE task_space_status_config SET sequence = $1 WHERE \"taskSpaceId\" = $2 AND id = $3`,
          [item.sequence, taskSpaceId, item.statusId],
        );
      }
    });
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    return { message: 'Status sequence updated' };
  }


  // ── Severity Config ───────────────────────────────────────────────────

  async getSeverityConfig(id: number, companyId: number) {
    const cached = await this.redisService.getTaskSpaceConfig(id);
    let severities: any[] = [];
    
    if (cached && (cached as any).severity) {
      severities = (cached as any).severity;
    } else {
      severities = await this.entityManager.query(
        `SELECT c.* FROM task_space_severity_config c WHERE c."taskSpaceId" = $1 ORDER BY c.id ASC`,
        [id],
      );
      if (severities.length > 0) {
        await this.seedSingleTaskSpaceCache(id);
      }
    }

    if (severities.length > 0) {
      const severityIds = severities.map((s) => s.id);
      const counts = await this.entityManager.query(
        `SELECT "severityId", COUNT(*) as count FROM tm_task WHERE "taskSpaceId" = $1 AND "severityId" = ANY($2) GROUP BY "severityId"`,
        [id, severityIds]
      );
      const countMap = new Map(counts.map((c: any) => [c.severityId, parseInt(c.count, 10)]));
      severities = severities.map((s) => ({
        ...s,
        taskCount: countMap.get(s.id) || 0,
      }));
      return { severities, availableSeverities: [] };
    }

    // No configured severities — return TSK-typed master severity records for initial setup
    const availableSeverities = await this.entityManager.find(Severity, {
      where: { postType: PostType.TSK },
      order: { id: 'ASC' },
      take: 3,
    });
    return { severities: [], availableSeverities };
  }

  async addSeverityToSpace(
    taskSpaceId: number,
    name: string,
    color: string,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const saved = await this.entityManager.transaction(async (em) => {
      const taskSpace = await em.findOne(TaskSpace, { where });
      if (!taskSpace)
        throw new NotFoundException(
          `Project space with ID ${taskSpaceId} not found`,
        );

      const newSeverityConfig = new TaskSpaceSeverityConfig();
      newSeverityConfig.taskSpaceId = taskSpaceId;
      newSeverityConfig.name = name;
      newSeverityConfig.color = color;
      newSeverityConfig.responseTimeInMinutes = 0;
      newSeverityConfig.resolutionTimeInMinutes = 0;
      const saved = await em.save(TaskSpaceSeverityConfig, newSeverityConfig);

      return saved;
    });

    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return saved;
  }

  async addExistingSeverityToSpace(
    taskSpaceId: number,
    severityId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    // Look up by id only — no companyId filter so master severities from any
    // company can be assigned to this task space (mirrors the available list).
    const severity = await this.entityManager.findOne(Severity, {
      where: { id: severityId },
    });
    if (!severity)
      throw new NotFoundException(`Severity with ID ${severityId} not found`);

    const existing = await this.entityManager.findOne(TaskSpaceSeverityConfig, {
      where: { taskSpaceId, name: severity.name }
    });
    if (existing)
      throw new BadRequestException(
        'A severity with this name already exists in this project space',
      );

    const newSeverityConfig = new TaskSpaceSeverityConfig();
    newSeverityConfig.taskSpaceId = taskSpaceId;
    newSeverityConfig.name = severity.name;
    newSeverityConfig.color = severity.color;
    newSeverityConfig.responseTimeInMinutes = 0;
    newSeverityConfig.resolutionTimeInMinutes = 0;
    const saved = await this.entityManager.save(TaskSpaceSeverityConfig, newSeverityConfig);

    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    return saved;
  }

  async removeSeverityFromSpace(
    taskSpaceId: number,
    severityId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    // Check if any tasks in this space are using the severity
    const [{ count }] = await this.entityManager.query(
      `SELECT COUNT(*) as count FROM tm_task WHERE "taskSpaceId" = $1 AND "severityId" = $2`,
      [taskSpaceId, severityId],
    );
    if (parseInt(count, 10) > 0)
      throw new BadRequestException(
        `Cannot remove this severity because it is currently assigned to ${count} task(s) in this space`,
      );

    await this.entityManager.delete(TaskSpaceSeverityConfig, { id: severityId, taskSpaceId });
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return { message: 'Severity removed' };
  }

  // ── Owners Config ─────────────────────────────────────────────────────

  async getOwnersConfig(id: number, activeCompanyId?: number) {
    // 1. Cache fast path
    const cached = await this.redisService.getTaskSpaceConfig(id);
    if (cached) {
      return { owners: (cached as any).owners ?? [] };
    }

    // 2. DB fallback
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: ['owners'],
    });
    if (!taskSpace)
      throw new NotFoundException(`Project space with ID ${id} not found`);

    await this.seedSingleTaskSpaceCache(id);
    return { owners: taskSpace.owners || [] };
  }

  // ── Resources Config ──────────────────────────────────────────────────

  async getResourcesConfig(id: number, companyId?: number) {
    // 1. Cache fast path (members blob — basic fields without skills)
    const cached = await this.redisService.getTaskSpaceConfig(id);
    if (cached) {
      return { resources: (cached as any).members ?? [] };
    }

    // 2. DB fallback
    const where: any = { id };
    if (companyId && companyId !== 0) {
      where.companyId = companyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: [
        'resources',
        'resources.resourceSkills',
        'resources.resourceSkills.skill',
      ],
    });
    if (!taskSpace)
      throw new NotFoundException(`Project space with ID ${id} not found`);

    let resources = taskSpace.resources || [];
    if (companyId) {
      resources = resources.filter(
        (r) => (r as unknown as { companyId?: number }).companyId === companyId,
      );
    }

    await this.seedSingleTaskSpaceCache(id);
    return {
      resources: resources.map((r) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        profile_pic: r.profile_pic,

        skills: (r.resourceSkills ?? [])
          .map(
            (rs: any) =>
              rs.skillName ?? (rs.skill as { name?: string } | null)?.name,
          )
          .filter((s): s is string => Boolean(s)),
      })),
    };
  }

  /** Search resources by name and return with their skills — used for the task space "Add Resource" dropdown. */
  async searchResourcesForSpace(
    query?: string,
    rows: number = 3,
    companyId?: number,
    taskSpaceId?: number, // 1. Added optional taskSpaceId parameter for fallback context
  ) {
    let resolvedCompanyId = companyId;

    // 2. Resolve companyId from taskSpaceId if it wasn't provided directly
    if (!resolvedCompanyId && taskSpaceId) {
      const taskSpace = await this.entityManager.findOne(TaskSpace, {
        where: { id: taskSpaceId },
      });
      if (taskSpace) {
        resolvedCompanyId = taskSpace.companyId;
      }
    }
    const qb = this.entityManager
      .getRepository(Resource)
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.resourceSkills', 'rs')
      .leftJoinAndSelect('rs.skill', 'skill')
      .take(rows)
      .orderBy('resource.id', 'DESC');

    if (resolvedCompanyId) {
      qb.andWhere('resource.companyId = :companyId', {
        companyId: resolvedCompanyId,
      });
    }

    if (query?.trim()) {
      qb.andWhere(
        new Brackets((innerQb) => {
          innerQb.where(
            'resource.first_name ILIKE :q OR resource.last_name ILIKE :q OR resource.email ILIKE :q OR skill.name ILIKE :q',
            { q: `%${query.trim()}%` },
          );
        }),
      );
    }

    const resources = await qb.getMany();
    return resources.map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      profile_pic: r.profile_pic,

      skills: (r.resourceSkills ?? [])
        .map((rs: any) => (rs.skill as { name?: string } | null)?.name)
        .filter((s): s is string => Boolean(s)),
    }));
  }

  /** Search resource pools by name for the task space's company. */
  async searchResourcePoolsForSpace(
    taskSpaceId: number,
    query: string,
    companyId?: number,
  ) {
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const taskSpace = await this.entityManager.findOne(TaskSpace, {
        where: { id: taskSpaceId },
      });
      if (!taskSpace)
        throw new NotFoundException(
          `Project space with ID ${taskSpaceId} not found`,
        );
      resolvedCompanyId = taskSpace.companyId;
    }

    const qb = this.entityManager
      .getRepository(ResourcePool)
      .createQueryBuilder('pool')
      .leftJoinAndSelect('pool.resources', 'resource')
      .leftJoinAndSelect('resource.resourceSkills', 'rs')
      .leftJoinAndSelect('rs.skill', 'skill')
      .where('pool.companyId = :companyId', { companyId: resolvedCompanyId })
      .andWhere('pool.isActive = true')
      .orderBy('pool.id', 'DESC');

    if (query?.trim()) {
      qb.andWhere('pool.name ILIKE :q', { q: `%${query.trim()}%` });
    }

    const pools = await qb.getMany();
    return pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      resources: (pool.resources ?? []).map((r) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        profile_pic: r.profile_pic,

        skills: (r.resourceSkills ?? [])
          .map(
            (rs: any) =>
              rs.skillName ?? (rs.skill as { name?: string } | null)?.name,
          )
          .filter((s): s is string => Boolean(s)),
      })),
    }));
  }

  /** Returns the 3 latest active resource pools for the task space's company, each with their resources + skills. */
  async getResourcePoolsForSpace(taskSpaceId: number, companyId?: number) {
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const taskSpace = await this.entityManager.findOne(TaskSpace, {
        where: { id: taskSpaceId },
      });
      if (!taskSpace)
        throw new NotFoundException(
          `Project space with ID ${taskSpaceId} not found`,
        );
      resolvedCompanyId = taskSpace.companyId;
    }

    const pools = await this.entityManager.find(ResourcePool, {
      where: { company: { id: resolvedCompanyId }, isActive: true },
      relations: [
        'resources',
        'resources.resourceSkills',
        'resources.resourceSkills.skill',
      ],
      order: { id: 'DESC' },
      take: 3,
    });

    return pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      resources: (pool.resources ?? []).map((r) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        profile_pic: r.profile_pic,

        skills: (r.resourceSkills ?? [])
          .map(
            (rs: any) =>
              rs.skillName ?? (rs.skill as { name?: string } | null)?.name,
          )
          .filter((s): s is string => Boolean(s)),
      })),
    }));
  }

  async addResourceToSpace(
    taskSpaceId: number,
    resourceId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: ['resources'],
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    const resource = await this.entityManager.findOne(Resource, {
      where: { id: resourceId },
    });
    if (!resource)
      throw new NotFoundException(`Resource with ID ${resourceId} not found`);

    if (taskSpace.resources?.some((r) => r.id === resourceId))
      throw new BadRequestException(
        'Resource already added to this project space',
      );

    taskSpace.resources = [...(taskSpace.resources || []), resource];
    await this.entityManager.save(TaskSpace, taskSpace);
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return resource;
  }

  async removeResourceFromSpace(
    taskSpaceId: number,
    resourceId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: ['resources'],
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    // Check if resource is the assignee of any task in this space
    const [{ assigneeCount }] = await this.entityManager.query(
      `SELECT COUNT(*) as "assigneeCount" FROM tm_task WHERE "taskSpaceId" = $1 AND "assigneeId" = $2`,
      [taskSpaceId, resourceId],
    );
    // Check if resource is a co-assignee on any task in this space
    const [{ coAssigneeCount }] = await this.entityManager.query(
      `SELECT COUNT(*) as "coAssigneeCount" FROM tm_task_co_assignees tca
       INNER JOIN tm_task t ON t.id = tca."taskId"
       WHERE t."taskSpaceId" = $1 AND tca."resourceId" = $2`,
      [taskSpaceId, resourceId],
    );
    const totalAssigned =
      parseInt(assigneeCount, 10) + parseInt(coAssigneeCount, 10);
    if (totalAssigned > 0)
      throw new BadRequestException(
        `Cannot remove this resource because they are assigned to ${totalAssigned} task(s) in this space.`,
      );

    const resourceToRemove = taskSpace.resources?.find((r) => r.id === resourceId);

    taskSpace.resources = (taskSpace.resources || []).filter(
      (r) => r.id !== resourceId,
    );
    await this.entityManager.save(TaskSpace, taskSpace);
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);

    if (resourceToRemove?.email) {
      void this.redisService.invalidateUserTaskSpacesByEmail(resourceToRemove.email);
    }

    return { message: 'Resource removed' };
  }

  async getTaskStatusCounts(
    taskSpaceId: number,
    activeCompanyId?: number,
  ): Promise<{
    hierarchyLevelName: string | null;
    counts: { statusId: number; name: string; color: string; count: number }[];
  }> {
    const bulk = await this.getBulkTaskStatusCounts(
      [taskSpaceId],
      activeCompanyId,
    );
    return bulk[taskSpaceId] ?? { hierarchyLevelName: null, counts: [] };
  }

  /** Single DB round-trip for all requested spaces — used by the space list page */
  async getBulkTaskStatusCounts(
    taskSpaceIds: number[],
    activeCompanyId?: number,
  ): Promise<
    Record<
      number,
      {
        hierarchyLevelName: string | null;
        counts: {
          statusId: number;
          name: string;
          color: string;
          count: number;
          hierarchyLevelName?: string | null;
        }[];
      }
    >
  > {
    if (!taskSpaceIds.length) return {};

    const where: any = { id: In(taskSpaceIds) };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpaces = await this.entityManager.find(TaskSpace, {
      where,
    });
    if (!taskSpaces.length) return {};

    const companyId = taskSpaces[0].companyId;

    // Top-level (lowest sequence) hierarchy level config per space
    const topLevels = await this.entityManager
      .createQueryBuilder(TaskSpaceHierarchyLevelConfig, 'hl')
      .where('hl.taskSpaceId IN (:...ids)', { ids: taskSpaceIds })
      .getMany();

    // Build map: spaceId → top-level config (lowest sequence)
    const topLevelBySpace: Record<
      number,
      TaskSpaceHierarchyLevelConfig | null
    > = {};
    taskSpaceIds.forEach((id) => (topLevelBySpace[id] = null));
    topLevels.forEach((hl) => {
      const cur = topLevelBySpace[hl.taskSpaceId];
      if (!cur || hl.sequence < cur.sequence)
        topLevelBySpace[hl.taskSpaceId] = hl;
    });

    interface BulkStatusCountRow {
      taskSpaceId: number;
      statusId: number;
      count: string;
    }

    const rows = await this.entityManager
      .createQueryBuilder(Task, 'task')
      .select('task.taskSpaceId', 'taskSpaceId')
      .addSelect('task.statusId', 'statusId')
      .addSelect('COUNT(task.id)', 'count')
      .where('task.taskSpaceId IN (:...taskSpaceIds)', { taskSpaceIds })
      .andWhere('task.statusId IS NOT NULL')
      .andWhere('task.parentTaskId IS NULL')
      .groupBy('task.taskSpaceId')
      .addGroupBy('task.statusId')
      .getRawMany<BulkStatusCountRow>();

    const statusIds = [...new Set(rows.map((r) => r.statusId))];
    const statuses = statusIds.length
      ? await this.entityManager.find(TaskSpaceStatusConfig, { where: { id: In(statusIds) } })
      : [];
    const statusMap = new Map<number, TaskSpaceStatusConfig>(statuses.map((s) => [s.id!, s]));

    const result: Record<
      number,
      { hierarchyLevelName: string | null; counts: any[] }
    > = {};
    taskSpaceIds.forEach((id) => {
      result[id] = {
        hierarchyLevelName: topLevelBySpace[id]?.name ?? null,
        counts: [],
      };
    });

    rows.forEach((r) => {
      const status = statusMap.get(r.statusId);
      if (status && parseInt(r.count) > 0) {
        result[r.taskSpaceId].counts.push({
          statusId: status.id,
          name: status.name,
          color: status.color,
          count: parseInt(r.count),
          hierarchyLevelName: result[r.taskSpaceId].hierarchyLevelName,
        });
      }
    });

    // Optionally sort the counts based on the config sequence
    Object.values(result).forEach(res => {
      res.counts.sort((a, b) => {
        const seqA = statusMap.get(a.statusId)?.sequence ?? 0;
        const seqB = statusMap.get(b.statusId)?.sequence ?? 0;
        return seqA - seqB;
      });
    });
    return result;
  }

  // Owner management
  async addOwnerToSpace(
    taskSpaceId: number,
    userId: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: ['owners'],
    });
    if (!taskSpace) {
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );
    }

    const user = await this.entityManager.findOne(User, {
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const alreadyOwner = taskSpace.owners?.some((o) => o.id === userId);
    if (alreadyOwner) {
      throw new BadRequestException(
        'User is already an owner of this project space',
      );
    }

    taskSpace.owners = [...(taskSpace.owners || []), user];
    const saved = await this.entityManager.save(TaskSpace, taskSpace);
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return saved;
  }

  async removeOwnerFromSpace(
    taskSpaceId: number,
    userId: number,
    activeCompanyId?: number,
  ): Promise<{ message: string }> {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
      relations: ['owners'],
    });
    if (!taskSpace) {
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );
    }

    const ownerToRemove = taskSpace.owners?.find((o) => o.id === userId);

    taskSpace.owners = (taskSpace.owners || []).filter((o) => o.id !== userId);
    await this.entityManager.save(TaskSpace, taskSpace);
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);

    if (ownerToRemove?.email) {
      void this.redisService.invalidateUserTaskSpacesByEmail(ownerToRemove.email);
    }

    return { message: 'Owner removed from project space' };
  }

  // ── Hierarchy Level Config management ────────────────────────────────

  /** Returns all space-specific configs */
  async getHierarchyLevelConfig(taskSpaceId: number, activeCompanyId?: number) {
    // 1. Cache fast path — return hierarchy config without live taskCounts
    const cached = await this.redisService.getTaskSpaceConfig(taskSpaceId);
    if (cached) {
      const cachedHierarchy: any[] = (cached as any).hierarchy ?? [];
      if (cachedHierarchy.length) {
        // Fetch live task counts (changes on every task create/move/delete — not cached)
        const configIds = cachedHierarchy.map((h) => h.id).filter(Boolean);
        const counts: { hierarchyLevelConfigId: number; count: string }[] =
          configIds.length
            ? await this.entityManager.query(
                `SELECT "hierarchyLevelConfigId", COUNT(*) AS count
                 FROM tm_task
                 WHERE "hierarchyLevelConfigId" = ANY($1)
                 GROUP BY "hierarchyLevelConfigId"`,
                [configIds],
              )
            : [];
        const countMap = new Map(
          counts.map((r) => [r.hierarchyLevelConfigId, parseInt(r.count, 10)]),
        );
        return cachedHierarchy.map((h) => ({
          ...h,
          taskCount: h.id != null ? (countMap.get(h.id) ?? 0) : 0,
        }));
      }
    }

    // 2. DB fallback
    const whereTS: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereTS.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where: whereTS,
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    const configs = await this.entityManager.find(
      TaskSpaceHierarchyLevelConfig,
      { where: { taskSpaceId }, order: { sequence: 'ASC' } },
    );

    if (!configs.length) return configs;

    // Count tasks per config in one query
    const configIds = configs.map((c) => c.id);
    const counts: { hierarchyLevelConfigId: number; count: string }[] =
      await this.entityManager.query(
        `SELECT "hierarchyLevelConfigId", COUNT(*) AS count
         FROM tm_task
         WHERE "hierarchyLevelConfigId" = ANY($1)
         GROUP BY "hierarchyLevelConfigId"`,
        [configIds],
      );

    const countMap = new Map(
      counts.map((r) => [r.hierarchyLevelConfigId, parseInt(r.count, 10)]),
    );

    // Lazy-populate cache on miss
    await this.seedSingleTaskSpaceCache(taskSpaceId);

    return configs.map((c) => ({
      ...c,
      taskCount: c.id != null ? (countMap.get(c.id) ?? 0) : 0,
    }));
  }

  /** Adds a hierarchy level to a task space using provided name/icon/color directly */
  async addHierarchyLevelToSpace(
    taskSpaceId: number,
    dto: AddHierarchyLevelConfigDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where,
    });
    if (!taskSpace)
      throw new NotFoundException(
        `Project space with ID ${taskSpaceId} not found`,
      );

    const config = new TaskSpaceHierarchyLevelConfig();
    config.taskSpaceId = taskSpaceId;
    config.sequence = dto.sequence;
    config.name = dto.name;
    config.icon = dto.icon ?? 'Folder';
    config.color = dto.color ?? '#6366f1';
    config.createdBy = authUser.email as string;

    const savedConfig = await this.entityManager.save(
      TaskSpaceHierarchyLevelConfig,
      config,
    );
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return savedConfig;
  }

  /** Updates the per-space config for a hierarchy level (name / icon / color / sequence). */
  async updateHierarchyLevelConfig(
    taskSpaceId: number,
    configId: number,
    dto: UpdateHierarchyLevelConfigDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const whereTS: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereTS.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where: whereTS,
    });
    if (!taskSpace) throw new NotFoundException('Project space not found');

    const config = await this.entityManager.findOne(
      TaskSpaceHierarchyLevelConfig,
      {
        where: { id: configId, taskSpaceId },
      },
    );
    if (!config) {
      throw new NotFoundException(
        `No hierarchy level config found with ID ${configId} in space ${taskSpaceId}`,
      );
    }

    if (dto.sequence !== undefined) config.sequence = dto.sequence;
    if (dto.name !== undefined) config.name = dto.name;
    if (dto.icon !== undefined) config.icon = dto.icon;
    if (dto.color !== undefined) config.color = dto.color;
    config.updatedBy = authUser.email as string;

    const savedHierarchyConfig = await this.entityManager.save(
      TaskSpaceHierarchyLevelConfig,
      config,
    );
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    return savedHierarchyConfig;
  }

  /** PATCH hierarchy level config — updates name/icon/color AND propagates the
   *  denormalised snapshot to every tm_task that references this config. */
  async patchHierarchyLevelConfig(
    taskSpaceId: number,
    configId: number,
    dto: { name?: string; icon?: string; color?: string },
    authUser: any,
  ) {
    const saved = await this.entityManager.transaction(async (em) => {
      const config = await em.findOne(TaskSpaceHierarchyLevelConfig, {
        where: { id: configId, taskSpaceId },
      });
      if (!config) {
        throw new NotFoundException(
          `No hierarchy level config found with ID ${configId} in space ${taskSpaceId}`,
        );
      }

      if (dto.name !== undefined && dto.name !== config.name) {
        const taskCount = await em.count(Task, {
          where: { hierarchyLevelConfigId: configId },
        });
        if (taskCount > 0) {
          throw new BadRequestException(
            'Cannot rename this hierarchy level because tasks are already assigned to it',
          );
        }
        config.name = dto.name;
      }
      if (dto.icon !== undefined) config.icon = dto.icon;
      if (dto.color !== undefined) config.color = dto.color;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      config.updatedBy = authUser.email as string;

      const saved = await em.save(TaskSpaceHierarchyLevelConfig, config);

      // Propagate denormalised snapshot to all tasks referencing this config
      const taskUpdate: Partial<Task> = {};
      if (dto.name !== undefined) taskUpdate.hierarchyLevelName = saved.name;
      if (dto.icon !== undefined) taskUpdate.hierarchyLevelIcon = saved.icon;
      if (dto.color !== undefined) taskUpdate.hierarchyLevelColor = saved.color;

      if (Object.keys(taskUpdate).length > 0) {
        await em.update(Task, { hierarchyLevelConfigId: configId }, taskUpdate);
      }

      return saved;
    });

    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    return saved;
  }

  /** Bulk-replaces all hierarchy level configs for a space in one operation. */
  async saveAllHierarchyLevels(
    taskSpaceId: number,
    levels: { name: string; icon?: string; color?: string }[],
    activeCompanyId?: number,
  ) {
    const where: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const savedConfigs = await this.entityManager.transaction(async (em) => {
      const taskSpace = await em.findOne(TaskSpace, { where });
      if (!taskSpace)
        throw new NotFoundException(
          `Project space with ID ${taskSpaceId} not found`,
        );

      // Delete all existing configs for this space
      await em.delete(TaskSpaceHierarchyLevelConfig, { taskSpaceId });

      if (!levels.length) return [];

      // Re-create in the supplied order (sequence = array index)
      const configs = levels.map((level, idx) => {
        const config = new TaskSpaceHierarchyLevelConfig();
        config.taskSpaceId = taskSpaceId;
        config.sequence = idx;
        config.name = level.name;
        config.icon = level.icon ?? 'Folder';
        config.color = level.color ?? '#6366f1';
        return config;
      });

      return em.save(TaskSpaceHierarchyLevelConfig, configs);
    });

    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    return savedConfigs;
  }

  /** Removes a hierarchy level config from a task space by its config ID. */
  async removeHierarchyLevelFromSpace(
    taskSpaceId: number,
    configId: number,
    activeCompanyId?: number,
  ): Promise<{ message: string }> {
    const whereTS: any = { id: taskSpaceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      whereTS.companyId = activeCompanyId;
    }

    const taskSpace = await this.entityManager.findOne(TaskSpace, {
      where: whereTS,
    });
    if (!taskSpace) throw new NotFoundException('Project space not found');

    const config = await this.entityManager.findOne(
      TaskSpaceHierarchyLevelConfig,
      { where: { id: configId, taskSpaceId } },
    );
    if (!config)
      throw new NotFoundException(`Hierarchy level config not found`);

    if (config.sequence <= 2) {
      throw new BadRequestException('Cannot delete default hierarchy levels');
    }

    const taskCount = await this.entityManager.count(Task, {
      where: { hierarchyLevelConfigId: configId },
    });
    if (taskCount > 0) {
      throw new BadRequestException(
        'Cannot delete this hierarchy level because tasks are already assigned to it.',
      );
    }
    await this.entityManager.delete(TaskSpaceHierarchyLevelConfig, {
      id: configId,
      taskSpaceId,
    });
    await this.redisService.deleteTaskSpaceConfig(taskSpaceId);
    await this.seedSingleTaskSpaceCache(taskSpaceId);
    return {
      message: 'Hierarchy level removed from project space',
    };
  }
  private async seedAllSpaceMemberships() {
    try {
      const queryStr = `
        WITH RECURSIVE TaskTree AS (
          SELECT r.email, r."companyId", t."taskSpaceId", t.id as "taskId"
          FROM tm_task t
          INNER JOIN tm_task_members tm ON t.id = tm."taskId"
          INNER JOIN resource r ON tm."resourceId" = r.id
          WHERE t."parentTaskId" IS NULL
          
          UNION
          
          SELECT parent.email, parent."companyId", child."taskSpaceId", child.id as "taskId"
          FROM tm_task child
          INNER JOIN TaskTree parent ON child."parentTaskId" = parent."taskId"
        )
        SELECT u.email, r."companyId", tso."taskSpaceId", NULL::int as "taskId" 
        FROM task_space_owners tso
        INNER JOIN "user" u ON tso."userId" = u.id
        LEFT JOIN resource r ON u.email = r.email

        UNION ALL

        SELECT r.email, r."companyId", tsr."taskSpaceId", NULL::int as "taskId" 
        FROM task_space_resources tsr
        INNER JOIN resource r ON tsr."resourceId" = r.id

        UNION ALL

        SELECT email, "companyId", "taskSpaceId", "taskId" FROM TaskTree
      `;

      const results = await this.entityManager.query(queryStr);

      console.log(
        `STARTING - Redis cache seeding for ${results.length} task space memberships`,
      );

      // cacheMap structure: key -> field -> visibilityDict (Record<number, number[]>)
      const cacheMap = new Map<string, Map<string, Record<number, number[]>>>();

      for (const row of results) {
        if (!row.email) continue;
        const companyId = row.companyId || 0;
        const key = `user_accessible_task_spaces:userId_${row.email}`;
        const field = `companyId_${companyId}`;
        const spaceId = row.taskSpaceId;
        const taskId = row.taskId;
        
        if (!cacheMap.has(key)) {
          cacheMap.set(key, new Map<string, Record<number, number[]>>());
        }
        const fieldMap = cacheMap.get(key)!;
        if (!fieldMap.has(field)) {
          fieldMap.set(field, {});
        }
        
        const visibilityDict = fieldMap.get(field)!;
        
        if (taskId === null) {
          // Space Owner or Member -> Full Access
          visibilityDict[spaceId] = [];
        } else {
          // Guest Member -> Add specific taskId if not already full access
          if (visibilityDict[spaceId] && visibilityDict[spaceId].length === 0) {
            continue;
          }
          if (!visibilityDict[spaceId]) {
            visibilityDict[spaceId] = [];
          }
          visibilityDict[spaceId].push(taskId);
        }
      }

      const pipeline = this.redisService.getClient().pipeline();
      for (const [key, fieldMap] of cacheMap.entries()) {
        for (const [field, visibilityDict] of fieldMap.entries()) {
          pipeline.hset(key, field, JSON.stringify(visibilityDict));
        }
      }
      await pipeline.exec();

      console.log(
        `FINISHED - Redis cache seeding for task space memberships.`,
      );
    } catch (err) {
      console.error('Failed to seed all space memberships:', err);
    }
  }

  private async invalidateTaskSpaceMembers(spaceId: number) {
    try {
      const queryStr = `
        SELECT u.email FROM task_space_owners tso
        INNER JOIN "user" u ON tso."userId" = u.id
        WHERE tso."taskSpaceId" = $1

        UNION

        SELECT r.email FROM task_space_resources tsr
        INNER JOIN resource r ON tsr."resourceId" = r.id
        WHERE tsr."taskSpaceId" = $1

        UNION

        SELECT r.email FROM tm_task_members tm
        INNER JOIN tm_task t ON t.id = tm."taskId"
        INNER JOIN resource r ON tm."resourceId" = r.id
        WHERE t."taskSpaceId" = $1
      `;
      const members = await this.entityManager.query(queryStr, [spaceId]);
      
      const emails: string[] = [];
      for (const m of members) {
        if (m.email) {
          emails.push(m.email);
        }
      }
      if (emails.length > 0) {
        await this.redisService.invalidateMultipleUsersTaskSpaces(emails);
      }
    } catch (e) {
      console.error('Failed to invalidate task space members:', e);
    }
  }
}
