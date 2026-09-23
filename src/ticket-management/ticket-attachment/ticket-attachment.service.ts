import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  CreateTicketAttachmentDto,
  UpdateTicketAttachmentDto,
} from './dto/ticket-attachment.dto';
import { TicketAttachment } from './ticket-attachment.entity';

@Injectable()
export class TicketAttachmentService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  async create(data: CreateTicketAttachmentDto, authUser: any) {
    const newAttachment = new TicketAttachment();
    newAttachment.link = data.link;
    newAttachment.ticketId = data.ticketId;
    newAttachment.createdBy = authUser?.email;

    const savedAttachment = await this.entityManager.save(newAttachment);
    return this.findOne(savedAttachment.id!);
  }

  async update(id: number, data: UpdateTicketAttachmentDto, authUser: any) {
    const attachment = await this.entityManager.findOne(TicketAttachment, {
      where: { id },
    });

    if (!attachment) {
      throw new HttpException(
        'Ticket attachment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    attachment.link = data.link;
    attachment.updatedBy = authUser?.email;
    await this.entityManager.save(attachment);

    return this.findOne(id);
  }

  async findOne(id: number) {
    const attachment = await this.entityManager.findOne(TicketAttachment, {
      where: { id },
    });

    if (!attachment) {
      throw new HttpException(
        'Ticket attachment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return attachment;
  }

  async findAll() {
    return await this.entityManager.find(TicketAttachment, {
      relations: ['ticket'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByTicket(ticketId: number) {
    return await this.entityManager.find(TicketAttachment, {
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });
  }

  async delete(id: number, authUser: any) {
    return await this.entityManager.transaction(async (manager) => {
      const attachment = await manager.findOne(TicketAttachment, {
        where: { id },
      });

      if (!attachment) {
        throw new HttpException(
          'Ticket attachment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      await manager.remove(attachment);
      return { message: 'Ticket attachment deleted', id };
    });
  }
}
