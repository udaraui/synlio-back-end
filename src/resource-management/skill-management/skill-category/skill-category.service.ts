import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  CreateSkillCategoryDto,
  UpdateSkillCategoryDto,
} from './dto/skill-category.dto';
import { SkillCategories } from './skill-category.entity';
import { Company } from '../../../company-management/company/company.entity';
import { Calendar } from '../../calendar/calendar.entity';
import { Skill } from '../skill/skill.entity';
import { SkillLevel } from '../skill-level/skill-level.entity';
import { ResourceSkill } from '../../resource/resource-skill.entity';

@Injectable()
export class SkillCategoryService {
  constructor(private readonly entityManager: EntityManager) {}

  async create(createSkillCategoryDto: CreateSkillCategoryDto, user: any) {
    try {
      const company = await this.entityManager.findOne(Company, {
        where: { id: createSkillCategoryDto.companyId },
      });

      if (!company) {
        throw new HttpException(
          "Sorry, the company doesn't exist",
          HttpStatus.BAD_REQUEST,
        );
      }

      const skillCategory = this.entityManager.create(SkillCategories, {
        name: createSkillCategoryDto.name,
        description: createSkillCategoryDto.description,
        isActive: createSkillCategoryDto.active_status,
        company: company,
        createdBy: user.email,
      });

      const savedSkillCategory = await this.entityManager.save(skillCategory);
      return savedSkillCategory;
    } catch (error) {
      throw new HttpException(
        'Sorry, something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    updateSkillCategoryDto: UpdateSkillCategoryDto,
    user: any,
  ) {
    try {
      const existing = await this.entityManager.findOne(SkillCategories, {
        where: { id },
      });
      if (!existing) {
        throw new HttpException(
          "Sorry, the skill category doesn't exist",
          HttpStatus.BAD_REQUEST,
        );
      }

      const company = await this.entityManager.findOne(Company, {
        where: { id: updateSkillCategoryDto.companyId },
      });
      if (!company) {
        throw new HttpException(
          "Sorry, the company doesn't exist",
          HttpStatus.BAD_REQUEST,
        );
      }

      existing.name = updateSkillCategoryDto.name ?? existing.name;
      existing.description =
        updateSkillCategoryDto.description ?? existing.description;
      existing.isActive = updateSkillCategoryDto.isActive ?? existing.isActive;
      existing.company = company;
      existing.updatedBy = user.email;

      const updatedSkillCategory = await this.entityManager.save(existing);
      return updatedSkillCategory;
    } catch (error) {
      throw new HttpException(
        'Sorry, something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async disable(id: number, authUser: any) {
    const skillCategories = await this.entityManager.findOne(SkillCategories, {
      where: { id },
    });

    if (!skillCategories) {
      throw new NotFoundException(`Skill Category with ID ${id} not found`);
    }

    const newIsActiveStatus = !skillCategories.isActive;

    await this.entityManager.update(SkillCategories, id, {
      isActive: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    return {
      message: `Skill Category status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async delete(id: number, user: any) {
    try {
      const skillRepository = this.entityManager.getRepository(Skill);
      const skillLevelRepository = this.entityManager.getRepository(SkillLevel);
      const resourceSkillRepository =
        this.entityManager.getRepository(ResourceSkill);

      const [
        relatedSkillsCount,
        relatedSkillLevelsCount,
        relatedResourceSkillsCount,
      ] = await Promise.all([
        skillRepository.count({
          where: { category: { id } },
        }),

        skillLevelRepository.count({
          where: { category: { id } },
        }),

        resourceSkillRepository.count({
          where: { skillCategory: { id } },
        }),
      ]);

      const totalAssociatedRecords =
        relatedSkillsCount +
        relatedSkillLevelsCount +
        relatedResourceSkillsCount;

      if (totalAssociatedRecords > 0) {
        const errorDetails: string[] = [];

        if (relatedSkillsCount > 0) {
          errorDetails.push(`- ${relatedSkillsCount} associated skill(s)`);
        }
        if (relatedSkillLevelsCount > 0) {
          errorDetails.push(
            `- ${relatedSkillLevelsCount} associated skill level(s)`,
          );
        }
        if (relatedResourceSkillsCount > 0) {
          errorDetails.push(
            `- ${relatedResourceSkillsCount} associated resource skill record(s)`,
          );
        }

        const detailedMessage = `Skill Category is currently linked to the following entities:\n${errorDetails.join('\n')}\n\nPlease unassign all skills and skill levels from this category first`;

        return {
          error: 'Cannot delete skill category due to active relationships',
          message: detailedMessage,
          status: 400,
        };
      }

      // If no children exist, proceed with deletion
      await this.entityManager.delete(SkillCategories, id);

      return {
        message: 'Skill Category deleted',
        status: 200,
      };
    } catch (error) {
      throw new HttpException(
        'Sorry, something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
