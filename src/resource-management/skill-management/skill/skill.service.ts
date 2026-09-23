import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';
import { Skill } from './skill.entity';
import { SkillCategories } from '../skill-category/skill-category.entity';
import { EntityManager } from 'typeorm';
import { ResourceSkill } from '../../resource/resource-skill.entity';

@Injectable()
export class SkillService {
  constructor(private readonly entityManager: EntityManager) {}

  async create(createSkillDto: CreateSkillDto, user: any) {
    try {
      const category = await this.entityManager.findOne(SkillCategories, {
        where: { id: createSkillDto.categoryId },
      });
      if (!category) {
        throw new HttpException(
          'Skill category not found',
          HttpStatus.NOT_FOUND,
        );
      }
      const skill = this.entityManager.create(Skill, {
        name: createSkillDto.name,
        category,
        isActive: true,
        createdBy: user.email,
      });
      const savedSkill = await this.entityManager.save(skill);
      return savedSkill;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async update(id: number, updateSkillDto: UpdateSkillDto, user: any) {
    try {
      const existing = await this.entityManager.findOne(Skill, {
        where: { id },
      });
      const category = await this.entityManager.findOne(SkillCategories, {
        where: { id: updateSkillDto.categoryId },
      });
      if (!existing) {
        throw new HttpException('Skill not found', HttpStatus.NOT_FOUND);
      }
      existing.name = updateSkillDto.name ?? existing.name;
      // existing.category = category as SkillCategories;
      existing.isActive = updateSkillDto.isActive ?? existing.isActive;
      existing.updatedBy = user.email;
      const updatedSkill = await this.entityManager.save(existing);
      return updatedSkill;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async disable(id: number, user: any) {
    const skill = await this.entityManager.findOne(Skill, { where: { id } });

    if (!skill) {
      throw new NotFoundException(`Skill with ID ${id} not found`);
    }

    const newIsActiveStatus = !skill.isActive;

    await this.entityManager.update(Skill, id, {
      isActive: newIsActiveStatus,
      updatedBy: user.email,
    });

    return {
      message: `Skill status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async delete(id: number, user: any) {
    try {
      const resourceSkillRepository =
        this.entityManager.getRepository(ResourceSkill);

      const relatedResourceSkillsCount = await resourceSkillRepository.count({
        where: { skill: { id } },
      });

      const totalAssociatedRecords = relatedResourceSkillsCount;

      if (totalAssociatedRecords > 0) {
        const errorDetails: string[] = [];

        if (relatedResourceSkillsCount > 0) {
          errorDetails.push(
            `- ${relatedResourceSkillsCount} associated resource skill record(s)`,
          );
        }

        const detailedMessage = `Skill is currently linked to the following entities:\n${errorDetails.join('\n')}\n\nPlease remove this skill from all resources first`;

        return {
          error: 'Cannot delete skill due to active relationships',
          message: detailedMessage,
          status: 400,
        };
      }

      // 3. If no children exist, proceed with deletion
      await this.entityManager.delete(Skill, id);

      return {
        message: 'Skill deleted',
        status: 200,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
