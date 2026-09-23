import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Email } from './email.entity';
import { CreateEmailDto, UpdateEmailDto } from './dto/email.dto';
import { ServiceBusService } from '../../common/azure/service-bus.service';
import { log } from 'console';

@Injectable()
export class EmailService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly serviceBusService: ServiceBusService,
  ) {}

  // ------------------------------------------------------------------ //
  //  Helpers
  // ------------------------------------------------------------------ //

  private readonly relations = ['company', 'user', 'attachments'];

  private async findOneOrFail(id: number): Promise<Email> {
    const email = await this.entityManager.findOne(Email, {
      where: { id },
      relations: this.relations,
    });
    if (!email) {
      throw new HttpException('Email record not found', HttpStatus.NOT_FOUND);
    }
    return email;
  }

  // ------------------------------------------------------------------ //
  //  Create
  // ------------------------------------------------------------------ //

  async create(data: CreateEmailDto, authUser: any): Promise<Email> {
    const email = new Email();

    email.from = data.from as string;
    email.to = data.to as string;
    email.ccTo = data.ccTo as string;
    email.subject = data.subject as string;
    email.description = data.description as string;
    email.companyId = (data.companyId ?? authUser?.companyId) as number;
    email.userId = data.userId as number;
    email.username = data.username as string;
    email.attachmentPath = data.attachmentPath as string;
    email.isSent = data.isSent ?? false;
    email.image = data.image as string;
    email.isError = data.isError ?? false;
    email.errorText = data.errorText as string;
    email.spaceId = data.spaceId as number;
    if (data.expiredAt) email.expiredAt = new Date(data.expiredAt);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    email.createdBy = authUser?.email as string;

    const saved = await this.entityManager.transaction(async (manager) => {
      return manager.save(email);
    });
    await this.serviceBusService.sendEmailJob(saved.id!);    
    return this.findOneOrFail(saved.id!);
  }

  // ------------------------------------------------------------------ //
  //  Read
  // ------------------------------------------------------------------ //

  async findOne(id: number): Promise<Email> {
    return this.findOneOrFail(id);
  }

  async findAll(): Promise<Email[]> {
    return this.entityManager.find(Email, {
      relations: this.relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findByCompany(companyId: number): Promise<Email[]> {
    return this.entityManager.find(Email, {
      where: { companyId },
      relations: this.relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: number): Promise<Email[]> {
    return this.entityManager.find(Email, {
      where: { userId },
      relations: this.relations,
      order: { createdAt: 'DESC' },
    });
  }

  // ------------------------------------------------------------------ //
  //  Update
  // ------------------------------------------------------------------ //

  async update(
    id: number,
    data: UpdateEmailDto,
    authUser: any,
  ): Promise<Email> {
    const email = await this.findOneOrFail(id);

    if (data.from !== undefined) email.from = data.from;
    if (data.to !== undefined) email.to = data.to;
    if (data.ccTo !== undefined) email.ccTo = data.ccTo;
    if (data.subject !== undefined) email.subject = data.subject;
    if (data.description !== undefined) email.description = data.description;
    if (data.companyId !== undefined) email.companyId = data.companyId;
    if (data.userId !== undefined) email.userId = data.userId;
    if (data.username !== undefined) email.username = data.username;
    if (data.attachmentPath !== undefined)
      email.attachmentPath = data.attachmentPath;
    if (data.isSent !== undefined) email.isSent = data.isSent;
    if (data.expiredAt !== undefined)
      email.expiredAt = data.expiredAt
        ? new Date(data.expiredAt)
        : (null as unknown as Date);
    if (data.image !== undefined) email.image = data.image;
    if (data.isError !== undefined) email.isError = data.isError;
    if (data.errorText !== undefined) email.errorText = data.errorText;
    if (data.spaceId !== undefined) email.spaceId = data.spaceId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    email.updatedBy = authUser?.email as string;

    await this.entityManager.save(email);
    return this.findOneOrFail(id);
  }

  // ------------------------------------------------------------------ //
  //  Delete
  // ------------------------------------------------------------------ //

  async delete(id: number): Promise<{ message: string; id: number }> {
    return this.entityManager.transaction(async (manager) => {
      const email = await manager.findOne(Email, {
        where: { id },
        relations: ['attachments'],
      });

      if (!email) {
        throw new HttpException('Email record not found', HttpStatus.NOT_FOUND);
      }

      if (email.attachments?.length) {
        await manager.remove(email.attachments);
      }

      await manager.remove(email);
      return { message: 'Email record deleted', id };
    });
  }
}
