import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TicketType } from './ticket-type.entity';
import {
  CreateTicketTypeDto,
  UpdateTicketTypeDto,
} from './dto/ticket-type.dto';

@Injectable()
export class TicketTypeService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  getAllTicketTypes() {
    return this.entityManager.find(TicketType, {
      order: { id: 'asc' },
    });
  }

  async createTicketType(ticketType: CreateTicketTypeDto, authUser: any) {
    const newTicketType = new TicketType();
    Object.assign(newTicketType, ticketType);
    newTicketType.createdBy = authUser.email;
    return this.entityManager.save(TicketType, newTicketType);
  }

  async updateTicketType(
    id: number,
    ticketTypeDto: UpdateTicketTypeDto,
    authUser: any,
  ): Promise<TicketType> {
    const existingTicketType = await this.entityManager.findOne(TicketType, {
      where: { id: id },
    });

    if (!existingTicketType) {
      throw new NotFoundException(`Ticket Type with ID ${id} not found`);
    }

    const mergedTicketType = this.entityManager.merge(
      TicketType,
      existingTicketType,
      ticketTypeDto,
    );

    mergedTicketType.updatedBy = authUser.email;

    return this.entityManager.save(mergedTicketType);
  }

  async deleteTicketType(id: number) {
    const ticketType = await this.entityManager.findOne(TicketType, {
      where: { id },
    });

    if (!ticketType) {
      throw new NotFoundException(`Ticket Type with ID ${id} not found`);
    }

    await this.entityManager.delete(TicketType, id);

    return {
      message: 'Ticket Type deleted',
      status: 200,
    };
  }
}
