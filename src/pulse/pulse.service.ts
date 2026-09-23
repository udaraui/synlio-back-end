import { buildEmailHtml } from '../common/email/email-template.helper';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brackets, EntityManager, ILike } from 'typeorm';
import { StatusBaseEnum } from '../common/enum/status-base.enum';
import { QueryParam } from '../common/common-db-operation/common-db-operation-query-param.dto';
import { Resource } from '../resource-management/resource/resource.entity';
import { Pulse } from './pulse.entity';
import { UpdatePulseDto } from './dto/pulse.dto';
import {
  CreatePulseWeekDto,
  SubmitPulseWeekDto,
  ForwardPulseWeekDto,
  ApprovePulseWeekDto,
  RejectPulseWeekDto,
} from './dto/pulse-week.dto';
import { PulseWeek } from './pulse-week.entity';
import { NewActivity } from './entities/new-activity.entity';
import { CreateNewActivityDto, LinkTaskToActivityDto } from './dto/new-activity.dto';
import { PulseSnapshotStatus } from '../common/enum/pulse-snapshot-status.enum';
import { PulseType } from '../common/enum/pulse-type.enum';
import { PostType } from '../common/enum/post-type.enum';
import { WorkLog } from '../work-log/work-log.entity';
import { Task } from '../task-management/task/task.entity';
import { Ticket } from '../ticket-management/ticket/ticket.entity';

import { EmailService } from '../alert/email/email.service';
import { Notification } from '../alert/notification/notification.entity';
import { ServiceBusService } from '../common/azure/service-bus.service';
import { User } from '../user-management/user/user.entity';
import { Company } from '../company-management/company/company.entity';
import { Calendar } from '../resource-management/calendar/calendar.entity';
import { CalendarDays } from '../resource-management/calendar/calendar-days.entity';

@Injectable()
export class PulseService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly emailService: EmailService,
    private readonly serviceBusService: ServiceBusService,
    @InjectRepository(NewActivity)
    private readonly newActivityRepository: Repository<NewActivity>,
  ) { }

  async getItemStatusConfig(
    postType: string,
    spaceId: number,
    postId: number,
    companyId: number,
  ): Promise<{ statuses: any[]; currentStatusId: number | null }> {
    let statuses = [];
    let currentStatusId = null;

    if (postType === 'Task' || postType === 'TSK') {
      statuses = await this.entityManager.query(
        `SELECT id, name, color, base
         FROM task_space_status_config
         WHERE "taskSpaceId" = $1
         ORDER BY sequence ASC`,
        [spaceId],
      );

      if (statuses.length === 0) {
        statuses = await this.entityManager.query(
          `SELECT id, name, color, base FROM status WHERE "isPrimaryBase" = true AND "postType" = 'Task'`
        );
      }

      const task = await this.entityManager.query(
        `SELECT "statusId" FROM tm_task WHERE id = $1`,
        [postId],
      );
      if (task && task.length > 0) currentStatusId = task[0].statusId;
    } else {
      statuses = await this.entityManager.query(
        `SELECT id, name, color, base
         FROM ticket_space_status_config
         WHERE "ticketSpaceId" = $1
         ORDER BY sequence ASC`,
        [spaceId],
      );

      if (statuses.length === 0) {
        statuses = await this.entityManager.query(
          `SELECT id, name, color, base FROM status WHERE "isPrimaryBase" = true AND "postType" = 'Ticket'`
        );
      }

      const ticket = await this.entityManager.query(
        `SELECT "statusId" FROM ticket WHERE id = $1`,
        [postId],
      );
      if (ticket && ticket.length > 0) currentStatusId = ticket[0].statusId;
    }

    return { statuses, currentStatusId };
  }

  async getItemProgress(postType: string, postId: number): Promise<{ progressPercentage: number | null }> {
    let progressPercentage = null;
    if (postType === 'Task' || postType === 'TSK') {
      const task = await this.entityManager.query(
        `SELECT "progressPercentage" FROM tm_task WHERE id = $1`,
        [postId],
      );
      if (task && task.length > 0) progressPercentage = task[0].progressPercentage;
    }
    return { progressPercentage };
  }

  async getItemDates(postType: string, postId: number): Promise<{ startDate: Date | null, dueDate: Date | null }> {
    let startDate = null;
    let dueDate = null;
    if (postType === 'Task' || postType === 'TSK') {
      const task = await this.entityManager.query(
        `SELECT "startDate", "dueDate" FROM tm_task WHERE id = $1`,
        [postId],
      );
      if (task && task.length > 0) {
        startDate = task[0].startDate;
        dueDate = task[0].dueDate;
      }
    }
    return { startDate, dueDate };
  }

  async getNeedsAttentionData(
    email: string,
    companyId: string,
    startDate?: string,
  ): Promise<any> {
    const currentDate = new Date();
    const selectedStartDate = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(currentDate.getDate() - 14));
    const query = `
    WITH UserTasks AS (
      -- 1. Fetch user's tasks with status info and timelines (ONLY leaf tasks with no children)
      SELECT
        t.id,
        t.code,
        t.name AS title,
        t."startDate" AS "startDate",
        t."dueDate" AS "dueDate",
        'Task' AS "postType",
        t."taskSpaceId" as "spaceId",
        t."taskSpaceName" as "spaceName",
        t."statusId",
        t."statusBase",
        t."statusName",
        t."statusColor",
        t."updatedAt",
        t."estimateEffort" AS "plannedEffort",
        t."actualEffort",
        COALESCE(t."progressPercentage", 0) AS "progressPercentage",
        -- CASE
        --   WHEN t."assigneeEmail" = $2 THEN 'Assignee'
        --   ELSE 'Co-Assignee'
        -- END AS "userRole",
        'Assignee' AS "userRole",
        -- Optimized Dynamic Condition Evaluation (Comma-Separated)
        NULLIF(CONCAT_WS(', ',
          CASE WHEN t."actualEffort" > t."estimateEffort" THEN 'exceed effort' END,
          CASE WHEN t."updatedAt" < $3 THEN 'stale' END,
          CASE WHEN t."dueDate" < $4 THEN 'overdue'
               WHEN t."dueDate" >= $4 THEN 'upcoming'
          END,
          -- NEW: 'lagging' condition based on exact inclusive days
          CASE 
            WHEN COALESCE(t."progressPercentage", 0) < (
              CASE
                -- Safety check for missing dates
                WHEN t."startDate" IS NULL OR t."dueDate" IS NULL THEN 0
                -- If due date is somehow before start date, assume 100% expected
                WHEN t."dueDate"::date < t."startDate"::date THEN 100.0
                -- If today is before the start date, 0% expected
                WHEN $4::date < t."startDate"::date THEN 0.0
                -- If today is past or equal to the due date, 100% expected
                WHEN $4::date >= t."dueDate"::date THEN 100.0
                -- Calculate inclusive days elapsed vs total inclusive days
                ELSE 
                  ( ($4::date - t."startDate"::date) + 1.0 ) / 
                  ( (t."dueDate"::date - t."startDate"::date) + 1.0 ) * 100.0
              END
            ) THEN 'lagging' 
          END
        ), '') AS "conditionStatus"
      FROM tm_task t
      WHERE t."companyId" = $1
        AND t."statusBase" != '${StatusBaseEnum.FINISHED}'
        -- FILTER: Exclude tasks that act as a parent to any other task
        AND NOT EXISTS (
          SELECT 1
          FROM tm_task child
          WHERE child."parentTaskId" = t.id
        )
        -- AND (
        --   t."assigneeEmail" = $2
        --   OR EXISTS (
        --     SELECT 1
        --     FROM tm_task_co_assignees tca
        --     JOIN resource r ON tca."resourceId" = r.id
        --     WHERE tca."taskId" = t.id
        --       AND r."email" = $2
        --   )
        -- )
        AND t."assigneeEmail" = $2
    ),
    UserTickets AS (
      -- 2. Fetch user's tickets with status info
      SELECT
        ti.id,
        ti.code,
        ti.name AS title,
        ti."createdAt" AS "startDate",
        ti."slaResolutionDeadline" AS "dueDate",
        'Ticket' AS "postType",
        ti."ticketSpaceId" as "spaceId",
        ti."ticketSpaceName" as "spaceName",
        ti."statusId",
        ti."statusBase",
        ti."statusName",
        ti."statusColor",
        ti."updatedAt",
        ti."plannedEffort",
        ti."actualEffort",
        0 AS "progressPercentage", -- Tickets typically lack this field; using 0 to match UNION columns
        -- CASE
        --   WHEN ti."assigneeEmail" = $2 THEN 'Assignee'
        --   ELSE 'Participant'
        -- END AS "userRole",
        'Assignee' AS "userRole",
        -- Optimized Dynamic Condition Evaluation (Comma-Separated)
        NULLIF(CONCAT_WS(', ',
          CASE WHEN ti."actualEffort" > ti."plannedEffort" THEN 'exceed effort' END,
          CASE WHEN ti."updatedAt" < $3 THEN 'stale' END,
          CASE WHEN ti."slaResolutionDeadline" < $4 THEN 'overdue'
               WHEN ti."slaResolutionDeadline" >= $4 THEN 'upcoming'
          END
        ), '') AS "conditionStatus"
      FROM ticket ti
      WHERE ti."companyId" = $1
        AND ti."statusBase" != '${StatusBaseEnum.FINISHED}'
        -- AND (
        --   ti."assigneeEmail" = $2
        --   OR EXISTS (
        --     SELECT 1
        --     FROM ticket_participants tp
        --     JOIN ticket_space_member perm ON tp."memberId" = perm.id
        --     WHERE tp."ticketId" = ti.id
        --       AND perm."userEmail" = $2
        --   )
        -- )
        AND ti."assigneeEmail" = $2
    ),
    TaskSpacePct AS (
      -- 3. Calculate AVG progress ONLY for spaces the user has active tasks in
      SELECT
        "taskSpaceName",
        ROUND(AVG("progressPercentage")::numeric, 2) AS "completionPct"
      FROM tm_task
      WHERE "parentTaskId" IS NULL
        AND "hierarchyLevelSequence" = 0
        AND "taskSpaceName" IN (SELECT DISTINCT "spaceName" FROM UserTasks WHERE "spaceName" IS NOT NULL)
      GROUP BY "taskSpaceName"
    ),
    TicketSpacePct AS (
      -- 4. Calculate ticket completion PCT ONLY for spaces the user has active tickets in
      SELECT
        "ticketSpaceName",
        ROUND(AVG(CASE WHEN "statusBase" = '${StatusBaseEnum.FINISHED}' THEN 100.0 ELSE 0.0 END)::numeric, 2) AS "completionPct"
      FROM ticket
      WHERE "ticketSpaceName" IN (SELECT DISTINCT "spaceName" FROM UserTickets WHERE "spaceName" IS NOT NULL)
      GROUP BY "ticketSpaceName"
    )

    -- 5. Combine everything
    SELECT
      t.id,
      t.code,
      t.title,
      t."startDate",
      t."dueDate",
      t."postType",
      t."spaceId",
      t."spaceName",
      t."userRole",
      t."statusId",
      t."statusBase",
      t."statusName",
      t."statusColor",
      COALESCE(tsp."completionPct", 0) AS "spaceCompletionPct",
      t."conditionStatus",
      t."plannedEffort",
      t."actualEffort",
      t."progressPercentage",
      t."updatedAt"
    FROM UserTasks t
    LEFT JOIN TaskSpacePct tsp ON t."spaceName" = tsp."taskSpaceName"
    WHERE t."conditionStatus" IS NOT NULL

    UNION ALL

    SELECT
      ti.id,
      ti.code,
      ti.title,
      ti."startDate",
      ti."dueDate",
      ti."postType",
      ti."spaceId",
      ti."spaceName",
      ti."userRole",
      ti."statusId",
      ti."statusBase",
      ti."statusName",
      ti."statusColor",
      COALESCE(tip."completionPct", 0) AS "spaceCompletionPct",
      ti."conditionStatus",
      ti."plannedEffort",
      ti."actualEffort",
      ti."progressPercentage",
      ti."updatedAt"
    FROM UserTickets ti
    LEFT JOIN TicketSpacePct tip ON ti."spaceName" = tip."ticketSpaceName"
    WHERE ti."conditionStatus" IS NOT NULL

    ORDER BY
      "dueDate" ASC NULLS LAST,
      "postType" ASC;
    `;
    return await this.entityManager.query(query, [
      companyId,
      email,
      selectedStartDate,
      currentDate,
    ]);
  }

  async getSynlioActivityData(
    email: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const dateTo = endDate ? new Date(endDate) : new Date();
    const dateFrom = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(dateTo.getDate() - 14));

    const query = `
      SELECT
          'Task' AS "postType",
          t.id AS "id",
          t.code AS "code",
          t.name AS "name",
          t."hierarchyLevelIcon" as "icon",
          t."hierarchyLevelColor" AS "color",
          t."taskSpaceName" AS "space",
          t."taskSpaceId" AS "spaceId",
          t."statusBase" AS "statusBase",
          te."occurredAt" AS "changeOccurredAt",
          COALESCE(wl.total_effort, 0) AS "totalEffortInRange",
          CASE
            WHEN t."assigneeEmail" = $2 THEN 'ASS'
            ELSE 'SBASS'
          END AS "userRole",
          -- Combines event metadata into a single JSON snapshot
          jsonb_build_object(
              'event_id', te.id,
              'event_type', te."eventType",
              'version', te.version,
              'actor_id', te."actorId",
              'payload', te.payload,
              'total_effort_in_range', COALESCE(wl.total_effort, 0)
          ) AS "change"

      FROM tm_task t

      -- 1. Get the events matching the date range directly via JOIN (Highly efficient)
      INNER JOIN tm_task_event te ON te."taskId" = t.id
--           AND te."actorId" = $2
          AND te."occurredAt" >= $3
          AND te."occurredAt" <= $4

      -- 2. Pull aggregated effort using a single LATERAL subquery per active task row
      LEFT JOIN LATERAL (
          SELECT SUM(effort) AS total_effort
          FROM work_log
          WHERE "companyId" = $1
            AND "postId" = t.id
            AND "postType" = 'Task'::post_type_enum
            and "resourceEmail" = $2
            AND "startTimeDate" <= $4
            AND "endTimeDate" >= $3
      ) wl ON TRUE

      -- 3. Check for co-assignees
      LEFT JOIN tm_task_co_assignees tca ON t.id = tca."taskId"
      LEFT JOIN resource r_co ON tca."resourceId" = r_co.id

      WHERE t."companyId" = $1
--         AND (t."statusBase" IS NULL OR t."statusBase" <> 'Finished')
        AND (
            t."assigneeEmail" = $2
            OR r_co.email = $2
        )

      UNION ALL

      -- SECTION 2: TICKETS & EVENTS
      SELECT
          'Ticket' AS "postType",
          tk.id AS "id",
          tk.code AS "code",
          tk.name AS "name",
          tk."ticketTypeIcon" AS "icon",
          '#3B82F6' AS "color",
          tk."ticketSpaceName" AS "space",
          tk."ticketSpaceId" AS "spaceId",
          tk."statusBase" AS "statusBase",
          tke."occurredAt" AS "changeOccurredAt",
          COALESCE(wl_tk.total_effort, 0) AS "totalEffortInRange", -- Added here to match the required structure
          CASE
            WHEN tk."assigneeEmail" = $2 THEN 'ASS'
            ELSE 'SBASS'
          END AS "userRole",
          -- Combines event metadata into a single JSON snapshot
          jsonb_build_object(
              'event_id', tke.id,
              'event_type', tke."eventType",
              'version', tke.version,
              'actor_id', tke."actorId",
              'payload', tke.payload,
              'total_effort_in_range', COALESCE(wl_tk.total_effort, 0)
          ) AS "change"

      FROM ticket tk

      -- 1. Get the events matching the date range directly via JOIN
      INNER JOIN ticket_event tke ON tke."ticketId" = tk.id
--           AND tke."actorId" = $2
          AND tke."occurredAt" >= $3
          AND tke."occurredAt" <= $4

      -- 2. Pull aggregated effort using a single LATERAL subquery per active ticket row
      LEFT JOIN LATERAL (
          SELECT SUM(effort) AS total_effort
          FROM work_log
          WHERE "companyId" = $1
            AND "postId" = tk.id
            AND "postType" = 'Ticket'::post_type_enum
            and "resourceEmail" = $2
            AND "startTimeDate" <= $4
            AND "endTimeDate" >= $3
      ) wl_tk ON TRUE

      -- 3. Check for ticket participants
      LEFT JOIN ticket_participants tp ON tk.id = tp."ticketId"
      LEFT JOIN ticket_space_member tprm ON tp."memberId" = tprm.id

      WHERE tk."companyId" = $1
--         AND (tk."statusBase" IS NULL OR tk."statusBase" <> 'Finished')
        AND (
            tk."assigneeEmail" = $2
            OR tprm."userEmail" = $2
        )

      UNION ALL

      -- SECTION 3: NEW ACTIVITIES
      SELECT
          'Activity' AS "postType",
          na.id AS "id",
          NULL AS "code",
          na.title AS "name",
          NULL AS "icon",
          '#10B981' AS "color",
          'No Space' AS "space",
          NULL AS "spaceId",
          NULL AS "statusBase",
          COALESCE(na."endDate", na."startDate") AS "changeOccurredAt",
          na."durationMinutes"::numeric / 60.0 AS "totalEffortInRange",
          'ASS' AS "userRole",
          jsonb_build_object(
              'event_id', na.id,
              'event_type', 'ACTIVITY_CREATED',
              'version', 1,
              'actor_id', na."ownerUserId",
              'payload', jsonb_build_object(),
              'total_effort_in_range', na."durationMinutes"::numeric / 60.0
          ) AS "change"

      FROM new_activity na

      WHERE na."companyId" = $1
        AND na."createdBy" = $2
        AND COALESCE(na."endDate", na."startDate") >= $3
        AND COALESCE(na."endDate", na."startDate") <= $4

      ORDER BY "changeOccurredAt" DESC;
    `;
    const results = await this.entityManager.query(query, [
      companyId,
      email,
      dateFrom,
      dateTo,
    ]);

    const ignoredFields = ['companyId', 'divisionId', 'updatedAt', 'updatedBy'];

    const filteredResults = results.filter((row: any) => {
      if (row.change && (row.change.event_type === 'TASK_UPDATED' || row.change.event_type === 'TICKET_UPDATED')) {
        const payload = row.change.payload;
        if (payload && typeof payload === 'object') {
          const keys = Object.keys(payload);
          const relevantKeys = keys.filter(k => !ignoredFields.includes(k));

          if (relevantKeys.length === 0) {
            // Drop the event if nothing meaningful changed
            return false;
          }

          // Rebuild payload with only relevant keys
          const newPayload: any = {};
          relevantKeys.forEach(k => newPayload[k] = payload[k]);
          row.change.payload = newPayload;
        }
      }
      return true;
    });

    return filteredResults;
  }

  async getLoggedUserWorkingHoursPerWeek(
    email: string,
    companyId: string,
  ): Promise<number> {

    const resource = await this.entityManager.findOne(Resource, {
      where: { email: ILike(email), companyId: Number(companyId) },
    });
    if (!resource) {
      // Default to 40 hours per week if the user is not found as a resource
      return 40;
    }
    return resource.working_hours * 5;
  }

  async updateSnapShot(
    id: number,
    updatePulseDto: UpdatePulseDto,
    user: any,
    activeCompanyId: number,
  ): Promise<Pulse> {
    const pulse = await this.entityManager.findOne(Pulse, {
      where: { id, companyId: activeCompanyId },
    });

    if (!pulse) {
      throw new NotFoundException(`Pulse snapshot with ID ${id} not found`);
    }

    Object.assign(pulse, updatePulseDto);
    pulse.updatedBy = user.email;

    return this.entityManager.save(pulse);
  }

  async syncPulseRecord(
    pulseWeekId: number,
    createPulseDto: any,
    user: any,
    activeCompanyId: number,
  ): Promise<Pulse> {
    const pulseWeek = await this.entityManager.findOne(PulseWeek, {
      where: { id: pulseWeekId, companyId: activeCompanyId },
    });
    if (!pulseWeek) {
      throw new NotFoundException(`Pulse week with ID ${pulseWeekId} not found`);
    }

    let pulse: Pulse | null = null;

    // For SYNLIO_ACTIVITY, we want to record every distinct change as a new row in the snapshot.
    // For other types (like MEETING_TIME, NEED_ATTENTION), we update the existing row for that post.
    if (createPulseDto.pulseType !== PulseType.SYNLIO_ACTIVITY) {
      pulse = await this.entityManager.findOne(Pulse, {
        where: {
          pulseWeekId: pulseWeek.id,
          postId: createPulseDto.postId,
          postType: createPulseDto.postType,
          pulseType: createPulseDto.pulseType,
        },
      });
    }

    if (pulse) {
      Object.assign(pulse, createPulseDto);
      if ((pulse.postType as any) === 'Activity') {
        pulse.postType = null as any;
      }
      pulse.updatedBy = user.email;
      pulse.updatedAt = new Date();
    } else {
      pulse = new Pulse();
      Object.assign(pulse, createPulseDto);
      if ((pulse.postType as any) === 'Activity') {
        pulse.postType = null as any;
      }
      pulse.companyId = activeCompanyId;
      pulse.pulseWeek = pulseWeek;
      pulse.pulseWeekId = pulseWeek.id!;
      pulse.createdBy = user.email;
      pulse.updatedBy = user.email;
    }

    const savedPulse = await this.entityManager.save(pulse);

    // Recalculate PulseWeek totals
    const allPulses = await this.entityManager.find(Pulse, {
      where: { pulseWeekId: pulseWeek.id },
    });

    const synlioActivityTime = allPulses
      .filter((p) => p.pulseType === PulseType.SYNLIO_ACTIVITY)
      .reduce((sum, p) => sum + Number(p.allocatedHours || 0), 0);

    const meetingTime = allPulses
      .filter((p) => p.pulseType === PulseType.MEETING_TIME)
      .reduce((sum, p) => sum + Number(p.allocatedHours || 0), 0);

    const workingHours = await this.getLoggedUserWorkingHoursPerWeek(
      user.email,
      activeCompanyId.toString(),
    );

    const missingTime = workingHours - (synlioActivityTime + meetingTime);

    pulseWeek.synlioActivityTime = synlioActivityTime;
    pulseWeek.meetingTime = meetingTime;
    pulseWeek.missingTime = missingTime;

    await this.entityManager.save(PulseWeek, pulseWeek);

    return savedPulse;
  }

  async createPulseWeek(
    createPulseWeekDto: CreatePulseWeekDto,
    user: any,
    activeCompanyId: number,
    isFromSchedule: boolean = false,
  ): Promise<any> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const {
          pulses,
          synlioActivityTime,
          meetingTime,
          needAttentionCount,
          taskFromMeetingCount,
          missingTime,
          userProfilePicture,
          ...pulseWeekData
        } = createPulseWeekDto;

        let existingPulseWeek = await transactionalEntityManager.findOne(
          PulseWeek,
          {
            where: {
              userId: user.userId,
              companyId: activeCompanyId,
              weekStartDate: createPulseWeekDto.weekStartDate,
            },
          },
        );

        const userResource = await transactionalEntityManager.findOne(
          Resource,
          {
            where: {
              email: user.email,
              company: { id: activeCompanyId },
            },
            relations: ['reportingPerson'],
          },
        );
        const reportingPerson = userResource?.reportingPerson;

        if (!existingPulseWeek) {
          // If the user is resubmitting a rejected snapshot but the new start date shifted (e.g. they want the data table to fetch from the actual rejected submission date),
          // we fallback to finding the most recent rejected snapshot to overwrite it.
          const latestRejected = await transactionalEntityManager.findOne(
            PulseWeek,
            {
              where: {
                userId: user.userId,
                companyId: activeCompanyId,
                status: PulseSnapshotStatus.REJECTED,
              },
              order: {
                createdAt: 'DESC',
              },
            },
          );
          if (latestRejected) {
            existingPulseWeek = latestRejected;
          }
        }

        let savedPulseWeek;

        if (existingPulseWeek) {
          if (
            existingPulseWeek.status === PulseSnapshotStatus.PENDING ||
            existingPulseWeek.status === PulseSnapshotStatus.FORWARDED ||
            existingPulseWeek.status === PulseSnapshotStatus.APPROVED
          ) {
            throw new BadRequestException('You already submitted this week snapshot');
          }

          await transactionalEntityManager.delete(Pulse, {
            pulseWeek: { id: existingPulseWeek.id },
          });

          Object.assign(existingPulseWeek, pulseWeekData);
          existingPulseWeek.weekStartDate = createPulseWeekDto.weekStartDate;
          existingPulseWeek.weekEndDate = createPulseWeekDto.weekEndDate;
          existingPulseWeek.updatedBy = isFromSchedule ? 'SYSTEM' : user.email;
          existingPulseWeek.updatedAt = new Date();
          existingPulseWeek.userProfilePicture =
            userProfilePicture ?? existingPulseWeek.userProfilePicture;
          existingPulseWeek.synlioActivityTime =
            synlioActivityTime ?? existingPulseWeek.synlioActivityTime;
          existingPulseWeek.meetingTime =
            meetingTime ?? existingPulseWeek.meetingTime;
          existingPulseWeek.needAttentionCount =
            needAttentionCount ?? existingPulseWeek.needAttentionCount;
          existingPulseWeek.taskFromMeetingCount =
            taskFromMeetingCount ?? existingPulseWeek.taskFromMeetingCount;
          existingPulseWeek.missingTime =
            missingTime ?? existingPulseWeek.missingTime;

          existingPulseWeek.status = createPulseWeekDto.status ?? PulseSnapshotStatus.PENDING;
          existingPulseWeek.rejectReason = null as any;
          existingPulseWeek.responsedAt = null as any;
          existingPulseWeek.approvedById = null as any;
          existingPulseWeek.approvedByEmail = null as any;
          existingPulseWeek.approvedByFullName = null as any;
          existingPulseWeek.approvedByProfilePicture = null as any;

          if (!isFromSchedule && reportingPerson) {
            existingPulseWeek.submittedToId = reportingPerson.id!;
            existingPulseWeek.submittedToEmail = reportingPerson.email;
            existingPulseWeek.submittedToFullName = (
              reportingPerson.first_name +
              ' ' +
              reportingPerson.last_name
            ).trim();
            existingPulseWeek.submittedToProfilePicture =
              reportingPerson.profile_pic || '';
          } else {
            if (isFromSchedule) {
              existingPulseWeek.submittedToId = null as any;
              existingPulseWeek.submittedToEmail = null as any;
              existingPulseWeek.submittedToFullName = null as any;
              existingPulseWeek.submittedToProfilePicture = null as any;
            } else {
              throw new NotFoundException(
                `Reporting person not found for the submitting user.`,
              );
            }
          }

          savedPulseWeek =
            await transactionalEntityManager.save(existingPulseWeek);
        } else {

          const newPulseWeek = new PulseWeek();
          Object.assign(newPulseWeek, pulseWeekData);
          newPulseWeek.companyId = activeCompanyId;

          newPulseWeek.createdBy = isFromSchedule ? 'SYSTEM' : user.email;
          newPulseWeek.createdAt = new Date();
          newPulseWeek.updatedBy = isFromSchedule ? 'SYSTEM' : user.email;
          newPulseWeek.updatedAt = new Date();
          newPulseWeek.userId = user.userId;
          newPulseWeek.userEmail = user.email;
          newPulseWeek.userFullName = user.username;
          newPulseWeek.userProfilePicture = userProfilePicture ?? '';
          newPulseWeek.synlioActivityTime = synlioActivityTime ?? 0;
          newPulseWeek.meetingTime = meetingTime ?? 0;
          newPulseWeek.needAttentionCount = needAttentionCount ?? 0;
          newPulseWeek.taskFromMeetingCount = taskFromMeetingCount ?? 0;
          newPulseWeek.missingTime = missingTime ?? 0;

          if (!isFromSchedule && reportingPerson) {
            newPulseWeek.submittedToId = reportingPerson.id!;
            newPulseWeek.submittedToEmail = reportingPerson.email;
            newPulseWeek.submittedToFullName = (
              reportingPerson.first_name +
              ' ' +
              reportingPerson.last_name
            ).trim();
            newPulseWeek.submittedToProfilePicture =
              reportingPerson.profile_pic || '';
          } else {
            if (isFromSchedule) {
              newPulseWeek.submittedToId = null as any;
              newPulseWeek.submittedToEmail = null as any;
              newPulseWeek.submittedToFullName = null as any;
              newPulseWeek.submittedToProfilePicture = null as any;
            } else {
              throw new NotFoundException(
                `Reporting person not found for the submitting user.`,
              );
            }
          }

          savedPulseWeek = await transactionalEntityManager.save(newPulseWeek);
        }

        let savedPulses: Pulse[] = [];
        if (pulses && pulses.length > 0) {
          const newPulses = pulses.map((createPulseDto) => {
            const newPulse = new Pulse();
            Object.assign(newPulse, createPulseDto);
            if ((newPulse.postType as any) === 'Activity') {
              newPulse.postType = null as any;
            }
            newPulse.companyId = activeCompanyId;
            newPulse.createdBy = isFromSchedule ? 'SYSTEM' : user.email;
            newPulse.createdAt = new Date();
            newPulse.updatedBy = isFromSchedule ? 'SYSTEM' : user.email;
            newPulse.updatedAt = new Date();
            newPulse.pulseWeek = savedPulseWeek;
            return newPulse;
          });

          savedPulses = await transactionalEntityManager.save(newPulses);
        }

        return { ...savedPulseWeek, pulses: savedPulses };
      },
    );
  }

  async getMyStatus(userEmail: string, companyId: number): Promise<any> {
    const today = new Date();
    const currentDateStr = today.toISOString().split('T')[0];

    // Determine the week end date from CalendarDays
    let currentCycleEnd = new Date(today);
    let currentCycleStart = new Date(today);

    if (companyId) {
      // Find calendar days row for today using Resource calendar or fallback to active Company calendar
      const result = await this.entityManager
        .createQueryBuilder(Resource, 'resource')
        .leftJoin(
          Calendar,
          'cal',
          'cal.id = COALESCE(resource."calendarId", (SELECT c.id FROM calendar c WHERE c."companyId" = resource."companyId" AND c."isActive" = true LIMIT 1))'
        )
        .innerJoin(
          CalendarDays,
          'cd',
          'cd."calendarId" = cal.id AND cd.date = :currentDateStr',
          { currentDateStr }
        )
        .where('resource.email = :userEmail', { userEmail })
        .andWhere('resource."companyId" = :companyId', { companyId })
        .select(['cd.weekStartDate AS "weekStartDate"', 'cd.weekEndDate AS "weekEndDate"'])
        .getRawOne();

      if (result && result.weekEndDate) {
        currentCycleEnd = new Date(result.weekEndDate);
        currentCycleEnd.setHours(23, 59, 59, 999);
        currentCycleStart = new Date(result.weekStartDate);
        currentCycleStart.setHours(0, 0, 0, 0);
      } else {
        // Fallback if no calendar found
        currentCycleEnd.setHours(23, 59, 59, 999);
        currentCycleStart.setDate(currentCycleEnd.getDate() - 7);
        currentCycleStart.setHours(0, 0, 0, 0);
      }
    } else {
      currentCycleEnd.setHours(23, 59, 59, 999);
      currentCycleStart.setDate(currentCycleEnd.getDate() - 7);
      currentCycleStart.setHours(0, 0, 0, 0);
    }

    const submissions = await this.entityManager.createQueryBuilder(PulseWeek, 'pw')
      .where('pw.userEmail = :userEmail', { userEmail })
      .andWhere('pw.companyId = :companyId', { companyId })
      .orderBy('pw.submittedAt', 'DESC', 'NULLS LAST')
      .getMany();

    let hasSubmittedForCycle = false;
    let lastSubmissionDate: string | null = null;

    if (submissions.length > 0) {
      const latest = submissions.find((sub) => sub.submittedAt != null);
      if (latest && latest.submittedAt) {
        const latestEndDate = new Date(latest.weekEndDate);
        if (
          latestEndDate.getFullYear() === currentCycleEnd.getFullYear() &&
          latestEndDate.getMonth() === currentCycleEnd.getMonth() &&
          latestEndDate.getDate() === currentCycleEnd.getDate()
        ) {
          hasSubmittedForCycle = true;
          lastSubmissionDate = latest.submittedAt.toISOString();
        }
      }
    }

    return { hasSubmittedForCycle, lastSubmissionDate };
  }


  async getPostHierarchy(
    postId: number,
    postType: string,
    companyId: string,
  ): Promise<any> {
    if (postType === 'Ticket') {
      const query = `
        SELECT 
          "ticketSpaceName" as "spaceName", 
          "ticketSpacePrefix" as "spacePrefix",
          name
        FROM ticket 
        WHERE id = $1 AND "companyId" = $2
      `;
      const result = await this.entityManager.query(query, [postId, companyId]);
      if (!result.length) throw new NotFoundException('Ticket not found');
      return {
        spaceName: result[0].spaceName,
        spacePrefix: result[0].spacePrefix,
        name: result[0].name,
        hierarchy: [],
      };
    } else if (postType === 'Task') {
      const query = `
        WITH RECURSIVE task_hierarchy AS (
          SELECT 
            id, 
            "parentTaskId", 
            name, 
            code, 
            "hierarchyLevelName", 
            "hierarchyLevelIcon", 
            "hierarchyLevelColor", 
            "taskSpaceName" as "spaceName", 
            "taskSpacePrefix" as "spacePrefix", 
            1 as depth
          FROM tm_task
          WHERE id = $1 AND "companyId" = $2

          UNION ALL

          SELECT 
            parent.id, 
            parent."parentTaskId", 
            parent.name, 
            parent.code, 
            parent."hierarchyLevelName", 
            parent."hierarchyLevelIcon", 
            parent."hierarchyLevelColor", 
            parent."taskSpaceName" as "spaceName", 
            parent."taskSpacePrefix" as "spacePrefix", 
            child.depth + 1
          FROM tm_task parent
          INNER JOIN task_hierarchy child ON parent.id = child."parentTaskId"
        )
        SELECT * FROM task_hierarchy ORDER BY depth DESC;
      `;
      const result = await this.entityManager.query(query, [postId, companyId]);
      if (!result.length) throw new NotFoundException('Task not found');

      const spaceName = result[0].spaceName;
      const spacePrefix = result[0].spacePrefix;

      const hierarchy = result.map((row: any) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        hierarchyLevelName: row.hierarchyLevelName,
        hierarchyLevelIcon: row.hierarchyLevelIcon,
        hierarchyLevelColor: row.hierarchyLevelColor,
      }));

      return { spaceName, spacePrefix, hierarchy };
    }

    throw new NotFoundException('Invalid post type');
  }

  async submitPulseWeek(
    id: number,
    submitPulseWeekDto: SubmitPulseWeekDto,
    user: any,
    activeCompanyId: number,
  ): Promise<PulseWeek> {
    const pulseWeek = await this.entityManager.findOne(PulseWeek, {
      where: { id, companyId: activeCompanyId },
    });
    if (!pulseWeek) {
      throw new NotFoundException(`Pulse week with ID ${id} not found.`);
    }

    const submitterResource = await this.entityManager.findOne(Resource, {
      where: {
        userId: pulseWeek.userId,
        companyId: activeCompanyId,
      },
    });

    if (!submitterResource || !submitterResource.reportingPersonId) {
      throw new NotFoundException(`Reporting person not found for the submitting user.`);
    }

    const reportingPerson = await this.entityManager.findOne(Resource, {
      where: {
        id: submitterResource.reportingPersonId,
        companyId: activeCompanyId,
      },
    });

    if (!reportingPerson) {
      throw new NotFoundException(`Reporting person not found.`);
    }

    pulseWeek.status = PulseSnapshotStatus.PENDING;
    pulseWeek.submittedToId = reportingPerson.id!;
    pulseWeek.submittedToEmail = reportingPerson.email;
    pulseWeek.submittedToFullName = `${reportingPerson.first_name} ${reportingPerson.last_name}`;
    pulseWeek.submittedToProfilePicture = reportingPerson.profile_pic || '';
    pulseWeek.submittedAt = new Date();
    pulseWeek.updatedBy = user.email;
    pulseWeek.updatedAt = new Date();

    return this.entityManager.save(pulseWeek);
  }

  async forwardPulseWeek(
    id: number,
    forwardPulseWeekDto: ForwardPulseWeekDto,
    user: any,
    activeCompanyId: number,
  ): Promise<PulseWeek> {
    const pulseWeek = await this.entityManager.findOne(PulseWeek, {
      where: { id, companyId: activeCompanyId },
    });
    if (!pulseWeek) {
      throw new NotFoundException(`Pulse week with ID ${id} not found.`);
    }

    const resource = await this.entityManager.findOne(Resource, {
      where: {
        id: forwardPulseWeekDto.submittedToId,
        companyId: activeCompanyId,
      },
    });
    if (!resource) {
      throw new NotFoundException(
        `Resource with ID ${forwardPulseWeekDto.submittedToId} not found.`,
      );
    }

    pulseWeek.status = PulseSnapshotStatus.FORWARDED;
    pulseWeek.submittedToId = resource.id!;
    pulseWeek.submittedToEmail = resource.email;
    pulseWeek.submittedToFullName = `${resource.first_name} ${resource.last_name}`;
    pulseWeek.submittedToProfilePicture = resource.profile_pic || '';
    pulseWeek.submittedAt = new Date();
    pulseWeek.updatedBy = user.email;
    pulseWeek.updatedAt = new Date();

    const savedPulseWeek = await this.entityManager.save(pulseWeek);

    const recipientUser = await this.entityManager.findOne(User, {
      where: { email: resource.email },
      select: ['id', 'email'],
    });

    const company = await this.entityManager.findOne(Company, {
      where: { id: activeCompanyId },
      select: ['notificationEmail'],
    });

    const actorUser = await this.entityManager.findOne(User, {
      where: { email: user.email },
      select: ['first_name', 'last_name', 'profile_picture'],
    });
    const actorFullName = actorUser
      ? `${actorUser.first_name} ${actorUser.last_name}`.trim() || user.email
      : user.email;
    const actorInitials = actorFullName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || '';
    const uploadsBaseUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
    const actorProfilePicUrl = actorUser?.profile_picture
      ? actorUser.profile_picture.startsWith('http')
        ? actorUser.profile_picture
        : `${uploadsBaseUrl}/uploads/users/${actorUser.profile_picture}`
      : null;

    if (forwardPulseWeekDto.forwardMessage) {
      const payload = {
        weekId: id,
        companyId: activeCompanyId,
        submittedToEmail: resource.email,
      };
      const base64Data = Buffer.from(JSON.stringify(payload)).toString('base64');
      const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
      const reviewUrl = `${frontendUrl}/pulse/review?data=${base64Data}`;
      const emailBody = buildEmailHtml({
        eventBadge: 'Pulse Snapshot',
        breadcrumb: 'Weekly Pulse',
        title: 'Pulse Snapshot Forwarded',
        actorName: actorFullName,
        actorInitials,
        actorProfilePicUrl,
        actionSentence: `<strong>${actorFullName}</strong> requested your review`,
        customDetailBlockHtml: forwardPulseWeekDto.forwardMessage ? `<div style="padding:16px;background-color:#f8fafc;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;color:#334155;font-size:14px;line-height:1.6;font-style:italic;">${forwardPulseWeekDto.forwardMessage}</div>` : '',
        ctaUrl: reviewUrl,
        ctaLabel: 'Review Snapshot',
      });

      await this.emailService.create({
        to: resource.email,
        subject: 'Pulse Snapshot Review Request',
        description: emailBody,
        companyId: activeCompanyId,
        userId: recipientUser?.id,
        username: recipientUser?.email,
        from: company?.notificationEmail || user.email,
      }, user);
    }

    if (recipientUser) {
      try {
        const notif = new Notification();
        notif.from = user.email;
        notif.to = resource.email;
        notif.userId = recipientUser.id!;
        notif.username = user.email;
        notif.title = 'Pulse Snapshot Forwarded';
        notif.description = 'A weekly pulse snapshot has been forwarded to you for review.';
        if (forwardPulseWeekDto.forwardMessage) {
          notif.description += `<br/>Message: ${forwardPulseWeekDto.forwardMessage}`;
        }
        notif.createdBy = user.email;
        notif.companyId = activeCompanyId;
        notif.isSent = false;
        notif.isRead = false;
        notif.referenceId = savedPulseWeek.id!;
        notif.referenceType = 'PulseWeek';

        const savedNotif = await this.entityManager.save(Notification, notif);
        await this.serviceBusService.sendNotificationJob(savedNotif.id!);
      } catch (notifErr) {
        console.error('Failed to send notification for forwarded pulse week:', notifErr);
      }
    }

    return savedPulseWeek;
  }

  async approvePulseWeek(
    id: number,
    approvePulseWeekDto: ApprovePulseWeekDto,
    user: any,
    activeCompanyId: number,
  ): Promise<PulseWeek> {
    const pulseWeek = await this.entityManager.findOne(PulseWeek, {
      where: { id, companyId: activeCompanyId },
    });
    if (!pulseWeek) {
      throw new NotFoundException(`Pulse week with ID ${id} not found`);
    }

    const emailToSearch = approvePulseWeekDto.approvedByEmail || user.email;

    const resource = await this.entityManager.findOne(Resource, {
      where: { email: emailToSearch, companyId: activeCompanyId },
    });
    if (!resource) {
      throw new NotFoundException(
        `Resource with email ${emailToSearch} not found`,
      );
    }

    pulseWeek.status = PulseSnapshotStatus.APPROVED;
    pulseWeek.approvedById = resource.id!;
    pulseWeek.approvedByEmail = resource.email;
    pulseWeek.approvedByFullName = `${resource.first_name} ${resource.last_name}`;
    pulseWeek.approvedByProfilePicture = resource.profile_pic || '';
    pulseWeek.responsedAt = new Date();
    pulseWeek.updatedBy = user.email;
    pulseWeek.updatedAt = new Date();

    return this.entityManager.save(pulseWeek);
  }

  async rejectPulseWeek(
    id: number,
    rejectPulseWeekDto: RejectPulseWeekDto,
    user: any,
    activeCompanyId: number,
  ): Promise<PulseWeek> {
    const pulseWeek = await this.entityManager.findOne(PulseWeek, {
      where: { id, companyId: activeCompanyId },
    });
    if (!pulseWeek) {
      throw new NotFoundException(`Pulse week with ID ${id} not found`);
    }

    pulseWeek.status = PulseSnapshotStatus.REJECTED;
    pulseWeek.rejectReason = rejectPulseWeekDto.rejectReason;
    pulseWeek.responsedAt = new Date();
    pulseWeek.updatedBy = user.email;
    pulseWeek.updatedAt = new Date();

    return this.entityManager.save(pulseWeek);
  }

  async searchPulse(
    queryParam: QueryParam,
    companyId: number,
    userEmail: string,
  ): Promise<{ total: number; data: PulseWeek[] }> {
    const { first, rows, multiSorts, filters } = queryParam;

    let query = this.entityManager
      .getRepository(PulseWeek)
      .createQueryBuilder('entity');

    if (companyId && companyId !== 0) {
      query = query.andWhere('entity.companyId = :companyId', { companyId });
    }

    if (userEmail) {
      query = query.andWhere(
        new Brackets((qb) => {
          qb.where('entity.userEmail = :userEmail', { userEmail })
            .orWhere('entity.submittedToEmail = :userEmail', { userEmail });
        }),
      );
    }

    if (filters) {
      filters.forEach((fl) => {
        if (fl.field === 'userEmail' && fl.matchMode === 'equals') {
          // For approvals tab: narrow down to a specific resource's submissions
          // This works with the security bracket (userEmail=me OR submittedTo=me)
          // because we additionally require userEmail = filterValue
          query = query.andWhere('entity.userEmail = :filterUserEmail', { filterUserEmail: fl.value });
        }
        if (fl.field === 'submittedToEmail' && fl.matchMode === 'equals') {
          query = query.andWhere('entity.submittedToEmail = :filterSubmittedEmail', { filterSubmittedEmail: fl.value });
        }
        // Date range filter: show pulse weeks whose weekStartDate falls in [start, end]
        if (fl.field === 'weekStartDate' && fl.matchMode === 'dateBetween') {
          if (Array.isArray(fl.value) && fl.value.length === 2) {
            const startDate = new Date(fl.value[0]).toISOString().split('T')[0];
            const endDate = new Date(fl.value[1]).toISOString().split('T')[0];
            query = query.andWhere(
              'DATE(entity.weekStartDate) BETWEEN :weekStartFrom AND :weekStartTo',
              { weekStartFrom: startDate, weekStartTo: endDate },
            );
          }
        }
      });
    }

    const total = await query.getCount();

    if (multiSorts) {
      multiSorts.forEach((ms) => {
        query = query.addOrderBy(
          `entity.${ms.field}`,
          +ms.order === -1 ? 'DESC' : 'ASC',
        );
      });
    }

    query = query.offset(first ? +first : 0).limit(rows ? +rows : 1000);

    const data = await query.getMany();

    return { total, data };
  }

  async getPulseWeekToApprove(
    weekId: number,
    companyId: number,
    submittedToEmail: string,
  ): Promise<{ data: PulseWeek | null }> {
    const pulseWeek = await this.entityManager.findOne(PulseWeek, {
      where: {
        id: weekId,
        companyId,
        submittedToEmail,
      },
    });

    return { data: pulseWeek };
  }

  async getPulseWeekPulses(weekId: number, companyId: number): Promise<{ data: Pulse[] }> {
    const pulses = await this.entityManager.find(Pulse, {
      where: {
        pulseWeek: { id: weekId },
        companyId,
      },
      order: { createdAt: 'ASC' },
    });

    return { data: pulses };
  }

  // ─── New Activity Methods ───────────────────────────────────────────────────

  async createNewActivity(
    userId: number,
    companyId: number,
    dto: CreateNewActivityDto,
    userEmail: string,
  ): Promise<NewActivity> {
    const activity = this.newActivityRepository.create({
      ownerUserId: userId,
      companyId,
      title: dto.title,
      description: dto.description ?? null,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      taskId: dto.taskId ?? null,
      createdBy: userEmail,
      updatedBy: userEmail,
    });

    // Calculate duration from start/end if not explicitly provided
    if (dto.durationMinutes && dto.durationMinutes > 0) {
      activity.durationMinutes = dto.durationMinutes;
    } else if (activity.startDate && activity.endDate) {
      const diffMs = activity.endDate.getTime() - activity.startDate.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));
      activity.durationMinutes = diffMinutes > 0 ? diffMinutes : null;
    }

    return this.newActivityRepository.save(activity);
  }

  async getNewActivities(
    userId: number,
    companyId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const conditions: string[] = [
      `na."ownerUserId" = $1`,
      `na."companyId" = $2`,
    ];
    const params: any[] = [userId, companyId];

    if (startDate) {
      params.push(new Date(startDate));
      conditions.push(`na."startDate" >= $${params.length}`);
    }
    if (endDate) {
      params.push(new Date(endDate));
      conditions.push(`na."startDate" <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        na.id                   AS id,
        na.title                AS title,
        na.description          AS description,
        na."startDate"          AS "startDate",
        na."endDate"            AS "endDate",
        na."durationMinutes"    AS "durationMinutes",
        na."taskId"             AS "taskId",
        na."createdAt"          AS "createdAt",
        t.code                  AS "linkedTaskCode",
        t.name                  AS "linkedTaskName"
      FROM new_activity na
      LEFT JOIN tm_task t ON t.id = na."taskId"
      WHERE ${whereClause}
      ORDER BY na."startDate" DESC
    `;

    const rows = await this.entityManager.query(sql, params);

    return rows.map((r: any) => ({
      id: r.id,
      postType: 'Activity' as const,
      title: r.title,
      description: r.description,
      startDate: r.startDate,
      endDate: r.endDate,
      durationMinutes: r.durationMinutes !== null ? Number(r.durationMinutes) : null,
      taskId: r.taskId !== null ? Number(r.taskId) : null,
      linkedTaskCode: r.linkedTaskCode ?? null,
      linkedTaskName: r.linkedTaskName ?? null,
      createdAt: r.createdAt,
    }));
  }

  async linkTaskToActivity(
    activityId: number,
    userId: number,
    companyId: number,
    dto: LinkTaskToActivityDto,
    userEmail: string,
  ): Promise<NewActivity> {
    const activity = await this.newActivityRepository.findOne({
      where: { id: activityId, ownerUserId: userId, companyId },
    });
    if (!activity) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }

    // Verify the task exists
    const task = await this.entityManager.query(
      `SELECT id, code, name FROM tm_task WHERE id = $1`,
      [dto.taskId],
    );
    if (!task || task.length === 0) {
      throw new NotFoundException(`Task with ID ${dto.taskId} not found`);
    }

    activity.taskId = dto.taskId;
    activity.updatedBy = userEmail;
    return this.newActivityRepository.save(activity);
  }

  async unlinkTaskFromActivity(
    activityId: number,
    userId: number,
    companyId: number,
    userEmail: string,
  ): Promise<NewActivity> {
    const activity = await this.newActivityRepository.findOne({
      where: { id: activityId, ownerUserId: userId, companyId },
    });
    if (!activity) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }

    activity.taskId = null;
    activity.updatedBy = userEmail;
    return this.newActivityRepository.save(activity);
  }

  async deleteNewActivity(
    activityId: number,
    userId: number,
    companyId: number,
  ): Promise<void> {
    const activity = await this.newActivityRepository.findOne({
      where: { id: activityId, ownerUserId: userId, companyId },
    });
    if (!activity) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }
    await this.newActivityRepository.remove(activity);
  }

  async logTimeOnPulse(
    weekId: number,
    pulseId: number,
    hours: number,
    startDate: string | undefined,
    endDate: string | undefined,
    user: any,
    activeCompanyId: number,
  ): Promise<any> {
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      // 1. Verify PulseWeek
      const pulseWeek = await transactionalEntityManager.findOne(PulseWeek, {
        where: { id: weekId, companyId: activeCompanyId },
      });

      if (!pulseWeek) {
        throw new NotFoundException(`PulseWeek with ID ${weekId} not found`);
      }
      if (!['DRAFT', 'REJECTED'].includes(pulseWeek.status.toUpperCase())) {
        throw new BadRequestException('Can only log time on DRAFT or REJECTED pulse weeks');
      }
      if (pulseWeek.userEmail !== user.email) {
        throw new BadRequestException('Can only log time on your own pulse week');
      }

      // 2. Verify Pulse
      const pulse = await transactionalEntityManager.findOne(Pulse, {
        where: { id: pulseId, companyId: activeCompanyId },
        relations: ['pulseWeek'],
      });

      if (!pulse || pulse.pulseWeek.id !== weekId) {
        throw new NotFoundException(`Pulse with ID ${pulseId} not found in this week`);
      }

      const prevHours = pulse.allocatedHours ?? 0;
      const difference = hours - prevHours;

      // 3. Update Pulse
      pulse.allocatedHours = hours;
      pulse.updatedBy = user.email;
      pulse.updatedAt = new Date();
      await transactionalEntityManager.save(pulse);

      // 4. Update PulseWeek
      if (pulse.pulseType === PulseType.SYNLIO_ACTIVITY) {
        pulseWeek.synlioActivityTime = Number(pulseWeek.synlioActivityTime ?? 0) + difference;
      } else if (pulse.pulseType === PulseType.MEETING_TIME) {
        pulseWeek.meetingTime = Number(pulseWeek.meetingTime ?? 0) + difference;
      }
      pulseWeek.updatedBy = user.email;
      pulseWeek.updatedAt = new Date();
      await transactionalEntityManager.save(pulseWeek);

      // 5. Create a WorkLog entry for the difference (if any and if it's a task/ticket)
      if (difference !== 0 && (pulse.postType === 'Task' || pulse.postType === 'Ticket')) {
        const resource = await transactionalEntityManager.findOne(Resource, {
          where: { email: user.email, companyId: activeCompanyId }
        });

        let divisionId: number | null = null;
        if (pulse.postType === 'Task' && pulse.postId) {
          const task = await transactionalEntityManager.findOne(Task, { where: { id: pulse.postId } });
          if (task?.divisionId) divisionId = task.divisionId;
        } else if (pulse.postType === 'Ticket' && pulse.postId) {
          const ticket = await transactionalEntityManager.findOne(Ticket, { where: { id: pulse.postId } });
          if (ticket?.divisionId) divisionId = ticket.divisionId;
        }

        const workLog = new WorkLog();
        workLog.companyId = activeCompanyId;
        workLog.divisionId = divisionId;
        workLog.postId = pulse.postId || 0;
        workLog.postCode = pulse.postCode || '';
        workLog.postType = pulse.postType === 'Task' ? PostType.TSK : PostType.TKT;
        workLog.resourceId = resource?.id || 0;
        workLog.resourceName = resource ? `${resource.first_name} ${resource.last_name}` : `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || user.email;
        workLog.resourceEmail = user.email;
        workLog.resourceType = pulse.resourceType;
        const startDateTime = startDate ? new Date(startDate) : new Date();
        const endDateTime = endDate ? new Date(endDate) : new Date();
        workLog.startTimeDate = startDateTime;
        workLog.endTimeDate = endDateTime;
        workLog.effort = difference;
        workLog.note = 'Logged via Pulse';
        workLog.createdBy = user.email;

        await transactionalEntityManager.save(WorkLog, workLog);
      }

      return {
        message: 'Time logged',
        pulse,
        pulseWeek: {
          synlioActivityTime: pulseWeek.synlioActivityTime,
          meetingTime: pulseWeek.meetingTime,
        },
      };
    });
  }
}

