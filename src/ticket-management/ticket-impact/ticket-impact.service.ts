import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TicketImpact } from './ticket-impact.entity';
import {
  CreateTicketImpactDto,
  UpdateTicketImpactDto,
} from './dto/ticket-impact.dto';

@Injectable()
export class TicketImpactService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  getAllTicketImpacts() {
    return this.entityManager.find(TicketImpact, {
      order: { id: 'asc' },
    });
  }

  async createTicketImpact(ticketImpact: CreateTicketImpactDto, authUser: any) {
    const newTicketImpact = new TicketImpact();
    Object.assign(newTicketImpact, ticketImpact);    
    newTicketImpact.createdBy = authUser?.email || authUser?.username || 'system';
    return this.entityManager.save(TicketImpact, newTicketImpact);
  }

  async updateTicketImpact(
    id: number,
    ticketImpactDto: UpdateTicketImpactDto,
    authUser: any,
  ): Promise<TicketImpact> {
    const existingTicketImpact = await this.entityManager.findOne(
      TicketImpact,
      {
        where: { id: id },
      },
    );

    if (!existingTicketImpact) {
      throw new NotFoundException(`Ticket Impact with ID ${id} not found`);
    }

    const mergedTicketImpact = this.entityManager.merge(
      TicketImpact,
      existingTicketImpact,
      ticketImpactDto,
    );

    mergedTicketImpact.updatedBy = authUser.email;

    return this.entityManager.save(mergedTicketImpact);
  }

  async deleteTicketImpact(id: number) {
    const ticketImpact = await this.entityManager.findOne(TicketImpact, {
      where: { id },
    });

    if (!ticketImpact) {
      throw new NotFoundException(`Ticket Impact with ID ${id} not found`);
    }

    await this.entityManager.delete(TicketImpact, id);

    return {
      message: 'Ticket Impact deleted',
      status: 200,
    };
  }
}
