import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, ILike } from 'typeorm';
import { TicketSpaceMember } from './ticket-space-member.entity';
import {
  CreateTicketSpaceMemberDto,
  ResponseTicketSpaceMemberDto,
  UpdateTicketSpaceMemberDto,
} from './dto/ticket-space-member.dto';
import { TicketSpace } from '../ticket-space/ticket-space.entity';
import { User } from '../../user-management/user/user.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';
import { RedisService } from '../../redis/redis.service';
import { TicketSpaceService } from '../ticket-space/ticket-space.service';

@Injectable()
export class TicketSpaceMemberService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => TicketSpaceService))
    private readonly ticketSpaceService: TicketSpaceService,
  ) {}

  async getTicketSpacePermissions(
    ticketSpaceId: number,
  ): Promise<ResponseTicketSpaceMemberDto[]> {
    const permissions = await this.entityManager.find(TicketSpaceMember, {
      where: { ticketSpaceId },
      relations: ['user', 'queues'],
      order: { createdAt: 'DESC' },
    });

    return permissions as ResponseTicketSpaceMemberDto[];
  }

  private async resolveUser(userIdOrResourceId: number): Promise<User | null> {
    let user = await this.entityManager.findOne(User, {
      where: { id: userIdOrResourceId },
    });
    if (!user) {
      const resource = await this.entityManager.findOne(Resource, {
        where: { id: userIdOrResourceId },
      });
      if (resource) {
        if (resource.userId) {
          user = await this.entityManager.findOne(User, {
            where: { id: resource.userId },
          });
        }
        if (!user && resource.email) {
          user = await this.entityManager.findOne(User, {
            where: { email: ILike(resource.email) },
          });
        }
      }
    }
    return user;
  }

  async addPermissionToTicketSpace(
    ticketSpaceId: number,
    createDto: CreateTicketSpaceMemberDto,
    authUser: any,
  ): Promise<ResponseTicketSpaceMemberDto> {
    // Verify ticket space exists
    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where: { id: ticketSpaceId },
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    // Try to resolve user or resource for denormalized fields without verifying existence
    const user = await this.resolveUser(createDto.userId);
    if (user && user.id) {
      createDto.userId = user.id;
    }
    let resource: any = null;
    if (!user) {
      resource = await this.entityManager.findOne(Resource, {
        where: { id: createDto.userId },
      });
    }


    // Verify queues exist (optional - owner doesn't need queues)
    let queues: TicketQueue[] = [];
    if (createDto.queueIds && createDto.queueIds.length > 0) {
      queues = await this.entityManager.findByIds(
        TicketQueue,
        createDto.queueIds,
      );

      if (queues.length !== createDto.queueIds.length) {
        throw new NotFoundException(`One or more queues not found`);
      }
    }

    // Check if permission already exists for this user in this ticket space
    const existingPermission = await this.entityManager.findOne(
      TicketSpaceMember,
      {
        where: {
          ticketSpaceId,
          userId: createDto.userId,
        },
      },
    );

    if (existingPermission) {
      throw new BadRequestException(
        `Permission already exists for this user in this ticket space`,
      );
    }

    // Create new permission with denormalized fields
    const permission = new TicketSpaceMember();
    permission.ticketSpaceId = ticketSpaceId;
    permission.userId = createDto.userId;
    permission.userFirstName = user?.first_name || resource?.first_name || '';
    permission.userLastName = user?.last_name || resource?.last_name || '';
    permission.userEmail = user?.email || resource?.email || '';
    permission.userProfilePicture = user?.profile_picture || resource?.profile_pic || null;


    permission.queues = queues;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    permission.createdBy = authUser.email as string;

    const saved = await this.entityManager.save(TicketSpaceMember, permission);

    const result = await this.entityManager.findOne(TicketSpaceMember, {
      where: { id: saved.id },
      relations: ['queues'],
    });
    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.ticketSpaceService.seedSingleTicketSpaceCache(ticketSpaceId);
    void this.redisService.invalidateUserTicketSpaces(permission.userId);
    return result as ResponseTicketSpaceMemberDto;
  }

  async updatePermission(
    ticketSpaceId: number,
    permissionId: number,
    updateDto: UpdateTicketSpaceMemberDto,
    authUser: any,
  ): Promise<ResponseTicketSpaceMemberDto> {
    let permission: TicketSpaceMember | null;
    permission = await this.entityManager.findOne(TicketSpaceMember, {
      where: { id: permissionId, ticketSpaceId },
      relations: ['queues'],
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission with ID ${permissionId} not found`,
      );
    }



    // Update queues if provided
    if (updateDto.queueIds !== undefined) {
      if (updateDto.queueIds.length > 0) {
        const queues = await this.entityManager.findByIds(
          TicketQueue,
          updateDto.queueIds,
        );

        if (queues.length !== updateDto.queueIds.length) {
          throw new NotFoundException(`One or more queues not found`);
        }

        permission.queues = queues;
      } else {
        // Empty array means remove all queues (for owners)
        permission.queues = [];
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    permission.updatedBy = authUser.email as string;

    const updated = await this.entityManager.save(TicketSpaceMember, permission);

    const result = await this.entityManager.findOne(TicketSpaceMember, {
      where: { id: updated.id },
      relations: ['queues'],
    });
    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.ticketSpaceService.seedSingleTicketSpaceCache(ticketSpaceId);
    void this.redisService.invalidateUserTicketSpaces(permission.userId);
    return result as ResponseTicketSpaceMemberDto;
  }

  async removePermission(
    ticketSpaceId: number,
    permissionId: number,
  ): Promise<{ message: string }> {
    const permission = await this.entityManager.findOne(TicketSpaceMember, {
      where: { id: permissionId, ticketSpaceId },
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission with ID ${permissionId} not found`,
      );
    }
    // Check if this permission is the assignee on any tickets in this space
    const [{ assigneeCount }] = await this.entityManager.query(
      `SELECT COUNT(*) as "assigneeCount" FROM ticket WHERE "ticketSpaceId" = $1 AND "assigneeId" = $2`,
      [ticketSpaceId, permissionId],
    );
    // Check if this permission is a participant on any tickets in this space
    const [{ participantCount }] = await this.entityManager.query(
      `SELECT COUNT(*) as "participantCount" FROM ticket_participants tp
       INNER JOIN ticket t ON t.id = tp."ticketId"
       WHERE t."ticketSpaceId" = $1 AND tp."memberId" = $2`,
      [ticketSpaceId, permissionId],
    );
    const totalAssigned =
      parseInt(assigneeCount, 10) + parseInt(participantCount, 10);
    if (totalAssigned > 0)
      throw new BadRequestException(
        `Cannot remove this member because they are assigned to ${totalAssigned} ticket(s) in this space`,
      );

    await this.entityManager.remove(TicketSpaceMember, permission);
    await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
    await this.ticketSpaceService.seedSingleTicketSpaceCache(ticketSpaceId);
    void this.redisService.invalidateUserTicketSpaces(permission.userId);
    return { message: 'Permission removed' };
  }

  async addBulkPermissionsToTicketSpace(
    ticketSpaceId: number,
    createDtos: CreateTicketSpaceMemberDto[],
    authUser: any,
  ): Promise<ResponseTicketSpaceMemberDto[]> {
    // Verify ticket space exists
    const ticketSpace = await this.entityManager.findOne(TicketSpace, {
      where: { id: ticketSpaceId },
    });

    if (!ticketSpace) {
      throw new NotFoundException(
        `Ticket space with ID ${ticketSpaceId} not found`,
      );
    }

    const results: ResponseTicketSpaceMemberDto[] = [];
    const errors: string[] = [];

    // Fetch Default queue for the space once (used for all members)
    const defaultQueue = await this.entityManager.findOne(TicketQueue, {
      where: { ticketSpaceId, name: 'Default' },
    });

    for (const createDto of createDtos) {
      try {
        // Try to resolve user or resource for denormalized fields without verifying existence
        const user = await this.resolveUser(createDto.userId);
        if (user && user.id) {
          createDto.userId = user.id;
        }
        let resource: any = null;
        if (!user) {
          resource = await this.entityManager.findOne(Resource, {
            where: { id: createDto.userId },
          });
        }

        // Verify queues exist
        let queues: TicketQueue[] = [];
        if (createDto.queueIds && createDto.queueIds.length > 0) {
          queues = await this.entityManager.findByIds(
            TicketQueue,
            createDto.queueIds,
          );

          if (queues.length !== createDto.queueIds.length) {
            errors.push(
              `One or more queues not found for user ${createDto.userId}`,
            );
            continue;
          }
        }

        // Ensure Default queue is always present
        if (defaultQueue && !queues.some((q) => q.id === defaultQueue.id)) {
          queues = [defaultQueue, ...queues];
        }

        // Check if permission already exists
        const existingPermission = await this.entityManager.findOne(
          TicketSpaceMember,
          {
            where: {
              ticketSpaceId,
              userId: createDto.userId,
            },
          },
        );

        if (existingPermission) {
          errors.push(`Permission already exists for user ${createDto.userId}`);
          continue;
        }

        // Create new permission
        const permission = new TicketSpaceMember();
        permission.ticketSpaceId = ticketSpaceId;
        permission.userId = createDto.userId;
        permission.userFirstName = user?.first_name || resource?.first_name || '';
        permission.userLastName = user?.last_name || resource?.last_name || '';
        permission.userEmail = user?.email || resource?.email || '';
        permission.userProfilePicture = user?.profile_picture || resource?.profile_pic || null;
        permission.queues = queues;
        permission.createdBy = authUser.email as string;
        const saved = await this.entityManager.save(
          TicketSpaceMember,
          permission,
        );
        const result = await this.entityManager.findOne(TicketSpaceMember, {
          where: { id: saved.id },
          relations: ['queues'],
        });
        results.push(result as ResponseTicketSpaceMemberDto);
      } catch (error) {
        errors.push(
          `Failed to add permission for user ${createDto.userId}: ${error.message}`,
        );
      }
    }

    if (errors.length > 0 && results.length === 0) {
      console.log("errors", errors);
      console.log("results", results);
      
      throw new BadRequestException({
        message: 'Failed to add any permissions',
        errors,
      });
    }

    if (results.length > 0) {
      await this.redisService.deleteTicketSpaceConfig(ticketSpaceId);
      await this.ticketSpaceService.seedSingleTicketSpaceCache(ticketSpaceId);
      
      for (const res of results) {
        if (res.userId !== undefined) {
          void this.redisService.invalidateUserTicketSpaces(res.userId);
        }
      }
    }
    return results;
  }
}
