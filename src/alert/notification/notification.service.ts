import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Notification } from './notification.entity';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
} from './dto/notification.dto';
import { ServiceBusService } from '../../common/azure/service-bus.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly serviceBusService: ServiceBusService,
  ) {}

  // ------------------------------------------------------------------ //
  //  Helpers
  // ------------------------------------------------------------------ //

  private readonly relations = ['company', 'user', 'attachments'];

  private async findOneOrFail(id: number): Promise<Notification> {
    const notification = await this.entityManager.findOne(Notification, {
      where: { id },
      relations: this.relations,
    });
    if (!notification) {
      throw new HttpException(
        'Notification record not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return notification;
  }

  // ------------------------------------------------------------------ //
  //  Create
  // ------------------------------------------------------------------ //

  async create(
    data: CreateNotificationDto,
    authUser: any,
  ): Promise<Notification> {
    const notification = new Notification();

    notification.from = data.from as string;
    notification.to = data.to as string;
    notification.title = data.title as string;
    notification.description = data.description as string;
    notification.companyId = (data.companyId ?? authUser?.companyId) as number;
    notification.userId = data.userId as number;
    notification.username = data.username as string;
    notification.attachmentPath = data.attachmentPath as string;
    notification.isSent = data.isSent ?? false;
    notification.isRead = data.isRead ?? false;
    notification.referenceId = data.referenceId as number;
    notification.referenceType = data.referenceType as string;
    notification.referenceSpaceId = data.referenceSpaceId as number;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    notification.createdBy = authUser?.email as string;

    // Save inside a transaction — job is dispatched only after commit
    const saved = await this.entityManager.transaction(async (manager) => {
      return manager.save(notification);
    });

    await this.serviceBusService.sendNotificationJob(saved.id!);
    return this.findOneOrFail(saved.id!);
  }

  // ------------------------------------------------------------------ //
  //  Read
  // ------------------------------------------------------------------ //

  async findOne(id: number): Promise<Notification> {
    return this.findOneOrFail(id);
  }

  async findAll(): Promise<Notification[]> {
    return this.entityManager.find(Notification, {
      relations: this.relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(
    userId: number,
    companyId?: number,
    limit = 5,
    offset = 0,
  ): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
    const whereClause: any = { userId };
    if (companyId) {
      whereClause.companyId = companyId;
    }

    const [data, total] = await this.entityManager.findAndCount(Notification, {
      where: whereClause,
      relations: this.relations,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const unreadCount = await this.entityManager.count(Notification, {
      where: { ...whereClause, isRead: false },
    });

    return { data, total, unreadCount };
  }

  async getUnreadCount(userId: number, companyId?: number): Promise<{ unreadCount: number }> {
    const whereClause: any = { userId, isRead: false };
    if (companyId) {
      whereClause.companyId = companyId;
    }
    const unreadCount = await this.entityManager.count(Notification, {
      where: whereClause,
    });
    return { unreadCount };
  }

  // ------------------------------------------------------------------ //
  //  Update
  // ------------------------------------------------------------------ //

  async update(
    id: number,
    data: UpdateNotificationDto,
    authUser: any,
  ): Promise<Notification> {
    const notification = await this.findOneOrFail(id);

    if (data.from !== undefined) notification.from = data.from;
    if (data.to !== undefined) notification.to = data.to;
    if (data.title !== undefined) notification.title = data.title;
    if (data.description !== undefined)
      notification.description = data.description;
    if (data.companyId !== undefined) notification.companyId = data.companyId;
    if (data.userId !== undefined) notification.userId = data.userId;
    if (data.username !== undefined) notification.username = data.username;
    if (data.attachmentPath !== undefined)
      notification.attachmentPath = data.attachmentPath;
    if (data.isSent !== undefined) notification.isSent = data.isSent;
    if (data.isRead !== undefined) notification.isRead = data.isRead;
    if (data.referenceId !== undefined)
      notification.referenceId = data.referenceId;
    if (data.referenceType !== undefined)
      notification.referenceType = data.referenceType;
    if (data.referenceSpaceId !== undefined)
      notification.referenceSpaceId = data.referenceSpaceId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    notification.updatedBy = authUser?.email as string;

    await this.entityManager.transaction(async (manager) => {
      await manager.save(notification);
    });

    return this.findOneOrFail(id);
  }

  // ------------------------------------------------------------------ //
  //  Mark as read helpers
  // ------------------------------------------------------------------ //

  async markAsRead(id: number, authUser: any): Promise<Notification> {
    const notification = await this.findOneOrFail(id);
    notification.isRead = true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    notification.updatedBy = authUser?.email as string;
    await this.entityManager.transaction(async (manager) => {
      await manager.save(notification);
    });
    return this.findOneOrFail(id);
  }

  async markAllAsRead(
    userId: number,
    authUser: any,
  ): Promise<{ updated: number }> {
    const result = await this.entityManager.transaction(async (manager) => {
      return manager
        .createQueryBuilder()
        .update(Notification)
        .set({
          isRead: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          updatedBy: authUser?.email as string,
        })
        .where('userId = :userId AND isRead = false', { userId })
        .execute();
    });
    return { updated: result.affected ?? 0 };
  }

  // ------------------------------------------------------------------ //
  //  Delete
  // ------------------------------------------------------------------ //

  async delete(id: number): Promise<{ message: string; id: number }> {
    return this.entityManager.transaction(async (manager) => {
      const notification = await manager.findOne(Notification, {
        where: { id },
        relations: ['attachments'],
      });

      if (!notification) {
        throw new HttpException(
          'Notification record not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (notification.attachments?.length) {
        await manager.remove(notification.attachments);
      }

      await manager.remove(notification);
      return { message: 'Notification record deleted', id };
    });
  }
}
