import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SkillLevel } from './skill-level.entity';
import { EntityManager } from 'typeorm';
import { SkillCategories } from '../skill-category/skill-category.entity';
import {
  CreateSkillLevelDto,
  UpdateSkillLevelDto,
} from './dto/skill-level.dto';
import { Skill } from '../skill/skill.entity';
import { ResourceSkill } from '../../resource/resource-skill.entity';

@Injectable()
export class SkillLevelService {
  constructor(private readonly entityManager: EntityManager) {}

  async createSkillLevel(data: CreateSkillLevelDto, user: any) {
    try {
      const category = await this.entityManager.findOne(SkillCategories, {
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new HttpException(
          'Skill category not found',
          HttpStatus.NOT_FOUND,
        );
      }
      const skillLevel = this.entityManager.create(SkillLevel, {
        name: data.name,
        star_count: data.star_count,
        category: category,
        isActive: true,
        createdBy: user.email,
      });
      return await this.entityManager.save(skillLevel);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateSkillLevel(id: number, data: UpdateSkillLevelDto, user: any) {
    try {
      const existing = await this.entityManager.findOne(SkillLevel, {
        where: { id },
        relations: ['category'],
      });
      if (!existing) {
        throw new HttpException('Skill level not found', HttpStatus.NOT_FOUND);
      }
      existing.name = data.name ?? existing.name;
      existing.star_count = data.star_count ?? existing.star_count;
      existing.isActive = data.isActive ?? existing.isActive;
      existing.updatedBy = user.email;
      return await this.entityManager.save(existing);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async disableSkillLevel(id: number, user: any) {
    const skillLevel = await this.entityManager.findOne(SkillLevel, {
      where: { id },
    });

    if (!skillLevel) {
      throw new NotFoundException(`Skill Level with ID ${id} not found`);
    }

    const newIsActiveStatus = !skillLevel.isActive;

    await this.entityManager.update(SkillLevel, id, {
      isActive: newIsActiveStatus,
      updatedBy: user.email,
    });

    return {
      message: `Skill Level status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async deleteSkillLevel(id: number, user: any) {
    try {
      const resourceSkillRepository =
        this.entityManager.getRepository(ResourceSkill);

      const relatedResourceSkillsCount = await resourceSkillRepository.count({
        // Check where the ResourceSkill record references this SkillLevel ID
        where: { skillLevel: { id } },
      });

      if (relatedResourceSkillsCount > 0) {
        const detailedMessage = `Skill Level is currently linked to the following entities:\n- ${relatedResourceSkillsCount} associated resource skill record(s)\n\nPlease remove this skill level from all resources first`;

        return {
          error: 'Cannot delete skill level due to active relationships',
          message: detailedMessage,
          status: 400,
        };
      }

      await this.entityManager.delete(SkillLevel, id);

      return {
        message: 'Skill Level deleted',
        status: 200,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
