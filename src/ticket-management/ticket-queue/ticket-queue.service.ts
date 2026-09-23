import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TicketQueue } from './ticket-queue.entity';
import {
  CreateTicketQueueDto,
  UpdateTicketQueueDto,
} from './dto/ticket-queue.dto';

@Injectable()
export class TicketQueueService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  getAllTicketQueues() {
    return this.entityManager.find(TicketQueue, {
      order: { id: 'asc' },
    });
  }

  async createTicketQueue(ticketQueue: CreateTicketQueueDto, authUser: any) {
    const newTicketQueue = new TicketQueue();
    Object.assign(newTicketQueue, ticketQueue);
    newTicketQueue.createdBy = authUser?.email || authUser?.username || 'system';
    return this.entityManager.save(TicketQueue, newTicketQueue);
  }

  async updateTicketQueue(
    id: number,
    ticketQueueDto: UpdateTicketQueueDto,
    authUser: any,
  ): Promise<TicketQueue> {
    const existingTicketQueue = await this.entityManager.findOne(TicketQueue, {
      where: { id: id },
    });

    if (!existingTicketQueue) {
      throw new NotFoundException(`Ticket Queue with ID ${id} not found`);
    }

    const mergedTicketQueue = this.entityManager.merge(
      TicketQueue,
      existingTicketQueue,
      ticketQueueDto,
    );

    mergedTicketQueue.updatedBy = authUser.email;

    return this.entityManager.save(mergedTicketQueue);
  }

  async deleteTicketQueue(id: number) {
    const ticketQueue = await this.entityManager.findOne(TicketQueue, {
      where: { id },
    });

    if (!ticketQueue) {
      throw new NotFoundException(`Ticket Queue with ID ${id} not found`);
    }

    if (ticketQueue.name === 'Default') {
      throw new BadRequestException('The Default queue cannot be deleted');
    }

    await this.entityManager.delete(TicketQueue, id);

    return {
      message: 'Ticket Queue deleted',
      status: 200,
    };
  }
}
