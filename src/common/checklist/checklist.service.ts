import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Checklist, ChecklistEntityType } from './checklist.entity';
import { CreateChecklistDto, UpdateChecklistDto } from './checklist.dto';
import { Task } from '../../task-management/task/task.entity';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TicketSpaceMember } from '../../ticket-management/ticket-space-member/ticket-space-member.entity';

/** Normalized assignee display fields, whatever table the assignee came from. */
interface AssigneeDisplay {
  name: string | null;
  email: string | null;
  profilePicUrl: string | null;
}

@Injectable()
export class ChecklistService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  /** Confirm the owning task/ticket exists before attaching a row to it. */
  private async assertParentExists(
    entityType: ChecklistEntityType,
    entityId: number,
  ): Promise<void> {
    const parent =
      entityType === 'Task'
        ? await this.entityManager.findOne(Task, { where: { id: entityId } })
        : await this.entityManager.findOne(Ticket, { where: { id: entityId } });

    if (!parent) {
      throw new HttpException(
        `${entityType} not found`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Look the assignee up in whichever table this entity type assigns from,
   * returning the denormalized display fields.
   */
  private async resolveAssignee(
    entityType: ChecklistEntityType,
    assigneeId: number,
  ): Promise<AssigneeDisplay> {
    if (entityType === 'Task') {
      const resource = await this.entityManager.findOne(Resource, {
        where: { id: assigneeId },
      });
      if (!resource) {
        throw new HttpException('Assignee not found', HttpStatus.BAD_REQUEST);
      }
      return {
        name:
          `${resource.first_name ?? ''} ${resource.last_name ?? ''}`.trim() ||
          null,
        email: resource.email ?? null,
        profilePicUrl: resource.profile_pic ?? null,
      };
    }

    const member = await this.entityManager.findOne(TicketSpaceMember, {
      where: { id: assigneeId },
    });
    if (!member) {
      throw new HttpException('Assignee not found', HttpStatus.BAD_REQUEST);
    }
    return {
      name:
        `${member.userFirstName ?? ''} ${member.userLastName ?? ''}`.trim() ||
        null,
      email: member.userEmail ?? null,
      profilePicUrl: member.userProfilePicture ?? null,
    };
  }

  /**
   * Apply an assignee change onto a row. `undefined` leaves it alone,
   * `null` clears it.
   */
  private async applyAssignee(
    item: Checklist,
    assigneeId: number | null | undefined,
  ): Promise<void> {
    if (assigneeId === undefined) return;

    if (assigneeId === null) {
      item.assigneeId = null;
      item.assigneeName = null;
      item.assigneeEmail = null;
      item.assigneeProfilePicUrl = null;
      return;
    }

    const display = await this.resolveAssignee(item.entityType, assigneeId);
    item.assigneeId = assigneeId;
    item.assigneeName = display.name;
    item.assigneeEmail = display.email;
    item.assigneeProfilePicUrl = display.profilePicUrl;
  }

  async create(data: CreateChecklistDto, authUser: any): Promise<Checklist> {
    await this.assertParentExists(data.entityType, data.entityId);

    const item = new Checklist();
    item.name = data.name;
    item.entityType = data.entityType;
    item.entityId = data.entityId;
    item.isChecked = data.isChecked ?? false;
    await this.applyAssignee(item, data.assigneeId ?? null);
    item.createdBy = authUser?.email as string;
    item.createdAt = new Date();

    return await this.entityManager.save(Checklist, item);
  }

  async update(
    id: number,
    data: UpdateChecklistDto,
    authUser: any,
  ): Promise<Checklist> {
    const item = await this.entityManager.findOne(Checklist, { where: { id } });
    if (!item) {
      throw new HttpException('Checklist item not found', HttpStatus.NOT_FOUND);
    }

    if (data.name !== undefined) item.name = data.name;
    if (data.isChecked !== undefined) item.isChecked = data.isChecked;
    await this.applyAssignee(item, data.assigneeId);
    item.updatedBy = authUser?.email as string;
    item.updatedAt = new Date();

    return await this.entityManager.save(Checklist, item);
  }

  async delete(id: number, _authUser: any): Promise<{ message: string }> {
    const item = await this.entityManager.findOne(Checklist, { where: { id } });
    if (!item) {
      throw new HttpException('Checklist item not found', HttpStatus.NOT_FOUND);
    }
    await this.entityManager.remove(Checklist, item);
    return { message: 'Checklist item deleted' };
  }

  async findByEntity(
    entityType: ChecklistEntityType,
    entityId: number,
  ): Promise<Checklist[]> {
    return await this.entityManager.find(Checklist, {
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Remove every checklist row belonging to a work item. The parent FK is gone
   * with the merge, so cascade-on-delete has to happen here.
   */
  async deleteByEntity(
    entityType: ChecklistEntityType,
    entityId: number,
  ): Promise<void> {
    await this.entityManager.delete(Checklist, { entityType, entityId });
  }

  /**
   * Clear an assignee wherever it is referenced. Replaces the ON DELETE SET
   * NULL the dedicated tables used to get for free.
   */
  async clearAssignee(
    entityType: ChecklistEntityType,
    assigneeId: number,
  ): Promise<void> {
    await this.entityManager.update(
      Checklist,
      { entityType, assigneeId },
      {
        assigneeId: null,
        assigneeName: null,
        assigneeEmail: null,
        assigneeProfilePicUrl: null,
      },
    );
  }
}
