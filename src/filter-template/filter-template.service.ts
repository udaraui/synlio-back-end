import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  FilterTemplate,
  FilterTemplateType,
  FilterTemplateVisibility,
} from './filter-template.entity';
import {
  CreateFilterTemplateDto,
  ShareFilterTemplateDto,
  UpdateFilterTemplateDto,
} from './dto/filter-template.dto';
import { User } from '../user-management/user/user.entity';

@Injectable()
export class FilterTemplateService {
  constructor(private readonly entityManager: EntityManager) {}

  async create(dto: CreateFilterTemplateDto, authUser: any): Promise<FilterTemplate> {
    const template = new FilterTemplate();
    template.name = dto.name;
    template.description = dto.description ?? undefined;
    template.type = dto.type;
    template.visibility = dto.visibility ?? FilterTemplateVisibility.PRIVATE;
    template.filters = dto.filters;
    template.userId = authUser.userId;
    template.companyId = authUser.activeCompanyId;
    template.createdBy = authUser.email;
    template.updatedBy = authUser.email;

    if (dto.sharedUserIds && dto.sharedUserIds.length > 0) {
      template.sharedWith = dto.sharedUserIds.map((id) => ({ id } as User));
      if (!dto.visibility) {
        template.visibility = FilterTemplateVisibility.SHARED;
      }
    } else {
      template.sharedWith = [];
    }

    return await this.entityManager.save(FilterTemplate, template);
  }

  async findAll(
    type: FilterTemplateType,
    authUser: any,
  ): Promise<{
    private: any[];
    sharedWithMe: any[];
    public: any[];
  }> {
    const companyId = authUser.activeCompanyId;
    const userId = authUser.userId;

    const qb = this.entityManager
      .createQueryBuilder(FilterTemplate, 'template')
      .leftJoinAndSelect('template.user', 'creator')
      .leftJoinAndSelect('template.sharedWith', 'sharedUser')
      .where('template.type = :type', { type });

    if (companyId) {
      qb.andWhere('template.companyId = :companyId', { companyId });
    }

    qb.andWhere(
      `(
        template.userId = :userId
        OR template.visibility = :public
        OR (template.visibility = :shared AND sharedUser.id = :userId)
      )`,
      {
        userId,
        public: FilterTemplateVisibility.PUBLIC,
        shared: FilterTemplateVisibility.SHARED,
      },
    );

    qb.orderBy('template.createdAt', 'DESC');

    const templates = await qb.getMany();

    const result = {
      private: [] as any[],
      sharedWithMe: [] as any[],
      public: [] as any[],
    };

    for (const t of templates) {
      const isOwner = t.userId === userId;
      const formatted = {
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        visibility: t.visibility,
        filters: t.filters,
        isDefault: t.isDefault,
        userId: t.userId,
        companyId: t.companyId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        isOwner,
        creator: t.user
          ? {
              id: t.user.id,
              first_name: t.user.first_name,
              last_name: t.user.last_name,
              email: t.user.email,
              profile_picture: t.user.profile_picture,
            }
          : null,
        sharedUserIds: (t.sharedWith || []).map((u) => u.id),
      };

      if (isOwner && t.visibility === FilterTemplateVisibility.PRIVATE) {
        result.private.push(formatted);
      } else if (isOwner && t.visibility === FilterTemplateVisibility.SHARED) {
        // Owner sees their shared template in private/my templates section with shared status
        result.private.push(formatted);
      } else if (!isOwner && t.visibility === FilterTemplateVisibility.SHARED) {
        result.sharedWithMe.push(formatted);
      } else if (t.visibility === FilterTemplateVisibility.PUBLIC) {
        result.public.push(formatted);
      }
    }

    return result;
  }

  async update(
    id: number,
    dto: UpdateFilterTemplateDto,
    authUser: any,
  ): Promise<FilterTemplate> {
    const template = await this.entityManager.findOne(FilterTemplate, {
      where: { id },
      relations: ['sharedWith'],
    });

    if (!template) {
      throw new NotFoundException('Filter template not found');
    }

    if (template.userId !== authUser.userId) {
      throw new ForbiddenException('Only the owner can update this template');
    }

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description;
    if (dto.visibility !== undefined) template.visibility = dto.visibility;
    if (dto.filters !== undefined) template.filters = dto.filters;

    if (dto.sharedUserIds !== undefined) {
      template.sharedWith = dto.sharedUserIds.map((uid) => ({ id: uid } as User));
    }

    template.updatedBy = authUser.email;
    return await this.entityManager.save(FilterTemplate, template);
  }

  async share(
    id: number,
    dto: ShareFilterTemplateDto,
    authUser: any,
  ): Promise<FilterTemplate> {
    const template = await this.entityManager.findOne(FilterTemplate, {
      where: { id },
      relations: ['sharedWith'],
    });

    if (!template) {
      throw new NotFoundException('Filter template not found');
    }

    if (template.userId !== authUser.userId) {
      throw new ForbiddenException('Only the owner can share this template');
    }

    const targetUserIds = (dto.userIds || []).filter((uid) => uid !== authUser.userId);
    template.sharedWith = targetUserIds.map((uid) => ({ id: uid } as User));

    if (dto.visibility) {
      template.visibility = dto.visibility;
    } else {
      template.visibility =
        targetUserIds.length > 0
          ? FilterTemplateVisibility.SHARED
          : FilterTemplateVisibility.PRIVATE;
    }

    template.updatedBy = authUser.email;
    return await this.entityManager.save(FilterTemplate, template);
  }

  async delete(id: number, authUser: any): Promise<void> {
    const template = await this.entityManager.findOne(FilterTemplate, {
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Filter template not found');
    }

    if (template.userId !== authUser.userId) {
      throw new ForbiddenException('Only the owner can delete this template');
    }

    await this.entityManager.delete(FilterTemplate, { id });
  }
}
