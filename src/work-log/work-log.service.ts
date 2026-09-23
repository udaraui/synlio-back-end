import {HttpException, HttpStatus, Injectable} from '@nestjs/common';
import {InjectEntityManager} from '@nestjs/typeorm';
import {EntityManager} from 'typeorm';
import {CreateWorkLogDto, UpdateWorkLogDto} from './dto/work-log.dto';
import {WorkLog} from './work-log.entity';
import {PostType} from '../common/enum/post-type.enum';
import {Task} from '../task-management/task/task.entity';
import { Ticket } from 'src/ticket-management/ticket/ticket.entity';
import { PulseWeek } from '../pulse/pulse-week.entity';
import { Pulse } from '../pulse/pulse.entity';
import { PulseType } from '../common/enum/pulse-type.enum';
import { AssigneeType } from '../common/enum/assignee-type.enum';
import { PulseSnapshotStatus } from '../common/enum/pulse-snapshot-status.enum';
import { TmTaskService } from '../task-management/task/task.service';

@Injectable()
export class WorkLogService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly taskService: TmTaskService,
  ) {}

  /**
   * Actual effort of a task/ticket is derived from its work logs:
   * it is the cumulative sum of the effort of every log added by the
   * assignee / co-assignees on that post. Recomputed after every
   * create / update / delete of a work log.
   *
   * For a parent task the two sources are additive:
   *   Actual Effort = sum of the children's actual effort
   *                 + sum of the parent's own work logs
   */
  private async syncActualEffortFromLogs(
    postType: PostType,
    postId: number,
    email: string,
  ): Promise<number | undefined> {
    if (!postId) return undefined;

    // Keyed on the post alone — postId is unique per post type, and the log
    // rows may carry a company id that differs from the post's own.
    const [row] = await this.entityManager.query(
      `SELECT COALESCE(SUM(effort), 0)::numeric AS "total"
         FROM work_log
        WHERE "postId" = $1 AND "postType"::text = $2`,
      [postId, postType as string],
    );
    const total = Number(row?.total) || 0;

    if (postType === PostType.TSK) {
      const task = await this.entityManager.findOne(Task, {
        where: { id: postId },
      });
      if (!task) return undefined;

      // Children roll-up and the task's own logs are additive.
      const [childRow] = await this.entityManager.query(
        `SELECT COALESCE(SUM("actualEffort"), 0)::numeric AS "childTotal"
           FROM tm_task
          WHERE "parentTaskId" = $1`,
        [postId],
      );
      const childTotal = Number(childRow?.childTotal) || 0;
      const actual = childTotal + total;

      await this.entityManager.update(
        Task,
        { id: postId },
        { actualEffort: actual as any, updatedBy: email, updatedAt: new Date() },
      );

      if (task.parentTaskId) {
        await this.taskService.rollupParent(task.parentTaskId, { email });
      }
      return actual;
    }

    const ticket = await this.entityManager.findOne(Ticket, {
      where: { id: postId },
    });
    if (!ticket) return undefined;

    await this.entityManager.update(
      Ticket,
      { id: postId },
      { actualEffort: total as any, updatedBy: email, updatedAt: new Date() },
    );
    return total;
  }

  async createResourceLog(
    dto: CreateWorkLogDto,
    email: string,
    companyId: number,
  ): Promise<WorkLog & { actualEffort?: number }> {
    const workLog = new WorkLog();
    workLog.companyId = companyId;
    let divisionId = dto.divisionId ?? null;
    if (dto.postId) {
      if (dto.postType === PostType.TSK) {
        const task = await this.entityManager.findOne(Task, {
          where: { id: dto.postId },
        });
        if (task?.divisionId) {
          divisionId = task.divisionId;
        }
      } else if (dto.postType === PostType.TKT) {
        const ticket = await this.entityManager.findOne(Ticket, {
          where: { id: dto.postId },
        });
        if (ticket?.divisionId) {
          divisionId = ticket.divisionId;
        }
      }
    }
    workLog.divisionId = divisionId;
    workLog.postId = dto.postId;
    workLog.postCode = dto.postCode;
    workLog.postEventId = dto.postEventId ?? null;
    workLog.postType =
      dto.postType === PostType.TSK ? PostType.TSK : PostType.TKT;
    workLog.resourceId = dto.resourceId;
    workLog.resourceName = dto.resourceName;
    workLog.resourceEmail = dto.resourceEmail;
    workLog.resourceType = dto.resourceType;
    workLog.startTimeDate = dto.startTimeDate ?? null;
    workLog.endTimeDate = dto.endTimeDate ?? null;
    workLog.effort = dto.effort ?? 0;
    workLog.note = dto.note ?? null;
    workLog.createdBy = email;

    const saved = await this.entityManager.save(workLog);

    let taskUpdatedAt: Date | undefined;
    let taskUpdatedBy: string | undefined;
    let taskName = '';
    let taskSpaceId = null;
    let taskSpaceName = '';
    let taskStatusBase = '';

    if (workLog.postType === PostType.TSK && workLog.postId) {
      const now = new Date();
      await this.entityManager.update(
        Task,
        { id: workLog.postId, companyId },
        { updatedAt: now, updatedBy: email },
      );
      taskUpdatedAt = now;
      taskUpdatedBy = email;
      
      const taskObj = await this.entityManager.findOne(Task, { where: { id: workLog.postId } });
      if (taskObj) {
        taskName = taskObj.name;
        taskSpaceId = taskObj.taskSpaceId as any;
        taskSpaceName = taskObj.taskSpaceName as any;
        taskStatusBase = taskObj.statusBase as any;
      }
    }else if(workLog.postType === PostType.TKT && workLog.postId){
      const now = new Date();
      await this.entityManager.update(
        Ticket,
        { id: workLog.postId, companyId },
        { updatedAt: now, updatedBy: email },
      );
      taskUpdatedAt = now;
      taskUpdatedBy = email;
      
      const ticketObj = await this.entityManager.findOne(Ticket, { where: { id: workLog.postId } });
      if (ticketObj) {
        taskName = ticketObj.name;
        taskSpaceId = ticketObj.ticketSpaceId as any;
        taskSpaceName = ticketObj.ticketSpaceName as any;
        taskStatusBase = ticketObj.statusBase as any;
      }
    }
    
    const actualEffort = await this.syncActualEffortFromLogs(
      workLog.postType,
      workLog.postId,
      email,
    );

    return { ...saved, actualEffort };
  }

  async getResourceTaskLogHistory(
    companyId: number,
    postId: number,
    resourceEmail: string,
  ): Promise<WorkLog[]> {
    return this.entityManager.find(WorkLog, {
      where: { companyId, postId, postType: PostType.TSK, resourceEmail },
      order: { createdAt: 'DESC' },
    });
  }

  async getResourceTicketLogHistory(
    companyId: number,
    postId: number,
    resourceEmail: string,
  ): Promise<WorkLog[]> {
    return this.entityManager.find(WorkLog, {
      where: { companyId, postId, postType: PostType.TKT, resourceEmail },
      order: { createdAt: 'DESC' },
    });
  }

  async patchResourceLog(
    companyId: number,
    id: number,
    dto: UpdateWorkLogDto,
    email: string,
  ): Promise<
    WorkLog & {
      taskUpdatedAt?: Date;
      taskUpdatedBy?: string;
      actualEffort?: number;
    }
  > {
    const workLog = await this.entityManager.findOne(WorkLog, {
      where: { id, companyId },
    });
    if (!workLog) {
      throw new HttpException('Work log not found', HttpStatus.NOT_FOUND);
    }

    // Only update fields that are explicitly provided in the DTO
    if (dto.startTimeDate !== undefined)
      workLog.startTimeDate = dto.startTimeDate;
    if (dto.endTimeDate !== undefined) workLog.endTimeDate = dto.endTimeDate;
    if (dto.effort !== undefined) workLog.effort = dto.effort;
    if (dto.note !== undefined) workLog.note = dto.note;

    workLog.updatedBy = email;

    const saved = await this.entityManager.save(workLog);

    // Touch the parent task's updatedAt when this is a task work log
    let taskUpdatedAt: Date | undefined;
    let taskUpdatedBy: string | undefined;
    if (workLog.postType === PostType.TSK && workLog.postId) {
      const now = new Date();
      await this.entityManager.update(
        Task,
        { id: workLog.postId, companyId },
        { updatedAt: now, updatedBy: email },
      );
      taskUpdatedAt = now;
      taskUpdatedBy = email;
    }else if(workLog.postType === PostType.TKT && workLog.postId){
      const now = new Date();
      await this.entityManager.update(
        Ticket,
        { id: workLog.postId, companyId },
        { updatedAt: now, updatedBy: email },
      );
      taskUpdatedAt = now;
      taskUpdatedBy = email;
    }

    const actualEffort = await this.syncActualEffortFromLogs(
      workLog.postType,
      workLog.postId,
      email,
    );

    return { ...saved, taskUpdatedAt, taskUpdatedBy, actualEffort };
  }

  async deleteResourceLog(
    companyId: number,
    id: number,
    email: string,
  ): Promise<{ message: string; actualEffort?: number }> {
    const workLog = await this.entityManager.findOne(WorkLog, {
      where: { id, companyId },
    });
    if (!workLog) {
      throw new HttpException('Work log not found', HttpStatus.NOT_FOUND);
    }

    const result = await this.entityManager.delete(WorkLog, {
      id,
      companyId,
    });
    if (result.affected === 0) {
      throw new HttpException('Work log not found', HttpStatus.NOT_FOUND);
    }

    const actualEffort = await this.syncActualEffortFromLogs(
      workLog.postType,
      workLog.postId,
      email,
    );

    return { message: 'Work log deleted', actualEffort };
  }
}