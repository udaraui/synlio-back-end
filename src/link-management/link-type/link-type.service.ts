import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { LinkType } from './link-type.entity';
import { CreateLinkTypeDto, UpdateLinkTypeDto } from './dto/link-type.dto';
import { PostType } from '../../common/enum/post-type.enum';
import { WorkItemLink } from '../work-item-link/work-item-link.entity';

@Injectable()
export class LinkTypeService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  async getAllLinkTypes(postType?: PostType) {
    const linkTypes = await this.entityManager.find(LinkType, {
      where: postType ? { postType } : {},
      order: { id: 'asc' },
    });
    if (linkTypes.length === 0) return linkTypes;

    const counts = await this.entityManager
      .createQueryBuilder(WorkItemLink, 'wl')
      .select('wl.linkTypeId', 'linkTypeId')
      .addSelect('COUNT(*)', 'count')
      .where('wl.linkTypeId IN (:...ids)', {
        ids: linkTypes.map((lt) => lt.id),
      })
      .groupBy('wl.linkTypeId')
      .getRawMany<{ linkTypeId: number; count: string }>();

    const usageMap = new Map(
      counts.map((c) => [c.linkTypeId, Number(c.count)]),
    );

    return linkTypes.map((lt) => ({
      ...lt,
      usageCount: (lt.id !== undefined ? usageMap.get(lt.id) : undefined) ?? 0,
    }));
  }

  async createLinkType(linkType: CreateLinkTypeDto, authUser: any) {
    const newLinkType = new LinkType();
    Object.assign(newLinkType, linkType);
    newLinkType.createdBy = authUser?.email;
    return this.entityManager.save(LinkType, newLinkType);
  }

  async updateLinkType(
    id: number,
    linkTypeDto: UpdateLinkTypeDto,
    authUser: any,
  ): Promise<LinkType> {
    const existing = await this.entityManager.findOne(LinkType, {
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Link Type with ID ${id} not found`);
    }
    const merged = this.entityManager.merge(LinkType, existing, linkTypeDto);
    merged.updatedBy = authUser?.email;
    return this.entityManager.save(merged);
  }

  async deleteLinkType(id: number) {
    const linkType = await this.entityManager.findOne(LinkType, {
      where: { id },
    });
    if (!linkType) {
      throw new NotFoundException(`Link Type with ID ${id} not found`);
    }

    const usageCount = await this.entityManager.count(WorkItemLink, {
      where: { linkTypeId: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${linkType.name}" — it is currently used by ${usageCount} link${usageCount > 1 ? 's' : ''}`,
      );
    }

    await this.entityManager.delete(LinkType, id);
    return { message: 'Link Type deleted', status: 200 };
  }
}
