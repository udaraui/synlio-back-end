import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TicketTemplate } from './ticket-template.entity';
import { CreateTicketTemplateDto, UpdateTicketTemplateDto } from './dto/ticket-template.dto';

@Injectable()
export class TicketTemplateService {
  constructor(
    @InjectEntityManager() private readonly entityManager: EntityManager,
  ) {}

  async search(
    spaceId: number | null,
    companyId: number | null,
    userEmail: string,
    nameFilter: string | null,
    first: number = 0,
    rows: number = 100
  ): Promise<{ total: number; data: TicketTemplate[] }> {
    const query = this.entityManager.createQueryBuilder(TicketTemplate, 'template')
      .where('(template.createdBy = :userEmail OR template.isShared = true)', { userEmail });

    if (spaceId) {
      query.andWhere('template.ticketSpaceId = :spaceId', { spaceId });
    }

    if (companyId) {
      query.andWhere('template.companyId = :companyId', { companyId });
    }

    if (nameFilter) {
      query.andWhere('template.name ILIKE :nameFilter', { nameFilter: `%${nameFilter}%` });
    }

    query.skip(first).take(rows);
    query.orderBy('template.createdAt', 'DESC'); // Default sorting

    const [data, total] = await query.getManyAndCount();

    return { total, data };
  }

  async create(createDto: CreateTicketTemplateDto, userEmail: string, companyId?: number): Promise<TicketTemplate> {
    const template = this.entityManager.create(TicketTemplate, {
      ...createDto,
      companyId,
      createdBy: userEmail,
      updatedBy: userEmail,
    });
    return await this.entityManager.save(TicketTemplate, template);
  }

  async update(id: number, updateDto: UpdateTicketTemplateDto, userEmail: string): Promise<TicketTemplate> {
    const template = await this.entityManager.findOne(TicketTemplate, { where: { id } });

    if (!template) {
      throw new NotFoundException(`TicketTemplate #${id} not found`);
    }

    Object.assign(template, updateDto);
    return await this.entityManager.save(TicketTemplate, template);
  }

  async remove(id: number, userEmail: string): Promise<void> {
    const template = await this.entityManager.findOne(TicketTemplate, { where: { id } });

    if (!template) {
      throw new NotFoundException(`TicketTemplate #${id} not found`);
    }

    await this.entityManager.remove(TicketTemplate, template);
  }
}
