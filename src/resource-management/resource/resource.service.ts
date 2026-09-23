import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, ILike, Brackets } from 'typeorm';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { Calendar } from '../calendar/calendar.entity';
import { Resource, ResourceType } from './resource.entity';
import { Skill } from '../skill-management/skill/skill.entity';
import { SkillLevel } from '../skill-management/skill-level/skill-level.entity';
import { SkillCategories } from '../skill-management/skill-category/skill-category.entity';
import { ResourceSkill } from './resource-skill.entity';
import { ResourceCost } from './resource-cost.entity';
import { Currency } from '../currency/currency.entity';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { ResourcePool } from '../resource-pool/resource-pool.entity';
import { uploadToAzure } from '../../common/azure/azure-image-upload';
import { normalizeEmail } from '../../common/email/email-normalize.helper';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';
import { In } from 'typeorm';
import { Task } from 'src/task-management/task/task.entity';
import { RedisService } from '../../redis/redis.service';
import { User } from '../../user-management/user/user.entity';
import { PulseWeek } from '../../pulse/pulse-week.entity';

@Injectable()
export class ResourceService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private redisService: RedisService,
  ) {}

  /**
   * A resource's skills are baked into the cached task space config blob, so a
   * skill change here leaves every space the resource belongs to serving stale
   * data. Drop those cache entries; they get rebuilt lazily on next read.
   */
  private async invalidateTaskSpaceCachesForResource(
    resourceId?: number,
  ): Promise<void> {
    if (!resourceId) return;
    try {
      const rows: { taskSpaceId: number }[] = await this.entityManager.query(
        `SELECT "taskSpaceId" FROM task_space_resources WHERE "resourceId" = $1`,
        [resourceId],
      );
      await Promise.all(
        rows.map((r) => this.redisService.deleteTaskSpaceConfig(r.taskSpaceId)),
      );
    } catch (err) {
      console.error(
        `[ResourceService] Failed to invalidate task space cache for resource ${resourceId}:`,
        err,
      );
    }
  }

  async checkEmailExists(email: string, companyId?: number): Promise<{ exists: boolean; resource?: Partial<Resource> }> {
    const where: any = { email: normalizeEmail(email) };
    if (companyId && companyId !== 0) {
      where.companyId = companyId;
    }

    const resource = await this.entityManager.findOne(Resource, { where });
    if (resource) {
      return {
        exists: true,
        resource: {
          id: resource.id,
          first_name: resource.first_name,
          last_name: resource.last_name,
          email: resource.email,
        },
      };
    }
    return { exists: false };
  }

  async createResource(
    data: CreateResourceDto,
    authUser: any,
    activeCompanyId?: number,
    file?: Express.Multer.File,
  ) {
    // Start the transaction
    const savedResource = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const targetCompanyId =
          activeCompanyId !== undefined && activeCompanyId !== 0
            ? activeCompanyId
            : Number((data as any).companyId);

        const parsedDivisionId = Number(data.divisionId);
        const parsedCalendarId = Number(data.calendarId);

        if (
          !Number.isInteger(targetCompanyId) ||
          !Number.isInteger(parsedDivisionId) ||
          !Number.isInteger(parsedCalendarId)
        ) {
          throw new HttpException(
            `Sorry, the company, division or calendar doesn't exist`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const companyData = await transactionalEntityManager.findOne(Company, {
          where: { id: targetCompanyId },
        });
        const divisionData = await transactionalEntityManager.findOne(
          Division,
          {
            where: { id: parsedDivisionId },
          },
        );
        const calendarData = await transactionalEntityManager.findOne(
          Calendar,
          {
            where: { id: parsedCalendarId },
          },
        );

        if (!companyData || !divisionData || !calendarData) {
          throw new HttpException(
            `Sorry, the company, division or calendar doesn't exist`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const resource = transactionalEntityManager.create(Resource, {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email ? normalizeEmail(data.email) : data.email,
          working_hours: data.working_hours,
          mobile: data.mobile,
          company: companyData,
          division: divisionData,
          calendar: calendarData,
          createdBy: authUser.email,
          reportingPersonId: data.reportingPersonId && Number(data.reportingPersonId) !== 0
            ? Number(data.reportingPersonId)
            : null,
          type: data.type || ResourceType.INTERNAL,
        });
        // Save the resource and get the saved entity (with its ID)
        let savedResource = await transactionalEntityManager.save(
          Resource,
          resource,
        );

        if (file) {
          savedResource.profile_pic = await uploadToAzure(
            file,
            savedResource.id as number,
          );
          savedResource = await transactionalEntityManager.save(savedResource);
        } else if ((data as any).profile_pic_url && typeof (data as any).profile_pic_url === 'string') {
          // Pre-filled from user account — use the URL directly (no re-upload needed)
          savedResource.profile_pic = (data as any).profile_pic_url;
          savedResource = await transactionalEntityManager.save(savedResource);
        }

        // Create and save resource skills
        let skillsArray = data.skills || [];
        if (typeof skillsArray === 'string') {
          try {
            skillsArray = JSON.parse(skillsArray);
          } catch (error) {
            throw new BadRequestException(
              'Skills must be a valid JSON string or array.',
            );
          }
        }

        for (const skillData of skillsArray) {
          const parsedSkillId = Number(skillData.skill?.id);
          const parsedSkillLevelId = Number(skillData.skillLevel?.id);
          const parsedSkillCategoryId = Number(skillData.skillCategory?.id);
          if (
            !Number.isInteger(parsedSkillId) ||
            !Number.isInteger(parsedSkillLevelId) ||
            !Number.isInteger(parsedSkillCategoryId)
          ) {
            // console.log(
            //   parsedSkillId,
            //   parsedSkillLevelId,
            //   parsedSkillCategoryId,
            // );
            throw new BadRequestException(
              'Invalid skill, skillLevel, or skillCategory id.',
            );
          }
          const skill = await transactionalEntityManager.findOne(Skill, {
            where: { id: parsedSkillId },
          });
          const skillLevel = await transactionalEntityManager.findOne(
            SkillLevel,
            {
              where: { id: parsedSkillLevelId },
            },
          );
          const skillCategory = await transactionalEntityManager.findOne(
            SkillCategories,
            {
              where: { id: parsedSkillCategoryId },
            },
          );
          if (!skill || !skillLevel || !skillCategory) {
            // This 'throw' will also roll back the transaction
            throw new HttpException(
              'Skill, SkillLevel, or SkillCategory not found.',
              HttpStatus.BAD_REQUEST,
            );
          }

          const resourceSkill = transactionalEntityManager.create(
            ResourceSkill,
            {
              resource: savedResource, // Use the saved resource
              resourceId: savedResource.id,
              skill,
              skillId: skill.id,
              skillName: skill.name,
              skillLevel,
              skillLevelId: skillLevel.id,
              skillLevelName: skillLevel.name,
              starCount: skillLevel.star_count,
              skillCategory,
              skillCategoryId: skillCategory.id,
              skillCategoryName: skillCategory.name,
              companyId: targetCompanyId,
            },
          );
          await transactionalEntityManager.save(ResourceSkill, resourceSkill);
        }

        // Handle optional resource cost
        const rawCostData = (data as any).resourceCost;
        let costData = rawCostData;
        if (typeof rawCostData === 'string') {
          try {
            costData = JSON.parse(rawCostData);
          } catch {
            costData = null;
          }
        }

        if (costData && costData.cost !== undefined && costData.cost !== null) {
          let currency: Currency | null = null;
          if (costData.currencyId) {
            currency = await transactionalEntityManager.findOne(Currency, {
              where: { id: Number(costData.currencyId) },
            });
            if (!currency) {
              throw new HttpException(
                `Currency with id ${costData.currencyId} not found`,
                HttpStatus.BAD_REQUEST,
              );
            }
          }

          const resourceCost = transactionalEntityManager.create(ResourceCost, {
            resource: savedResource,
            cost: costData.cost,
            currency: currency ?? undefined,
            rate_type: costData.rate_type,
            createdBy: authUser.email,
          });
          await transactionalEntityManager.save(ResourceCost, resourceCost);
        }

        // If we reach here, all saves were successful.
        // The transaction will automatically commit.
        return savedResource;
      },
    );

    await this.invalidateTaskSpaceCachesForResource(savedResource?.id);
    return savedResource;
  }

  async updateResource(
    id: number,
    data: UpdateResourceDto,
    authUser: any,
    activeCompanyId?: number,
    file?: Express.Multer.File,
  ) {
    // Start the transaction
    const updatedResource = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // Fetch existing resource
        const where: any = { id };
        if (activeCompanyId && activeCompanyId !== 0) {
          where.company = { id: activeCompanyId };
        }

        const resource = await transactionalEntityManager.findOne(Resource, {
          where,
          relations: ['company', 'division', 'calendar'],
        });

        if (!resource) {
          throw new HttpException(
            'Resource not found',
            HttpStatus.BAD_REQUEST,
          );
        }

        const rawDivisionId =
          (data as any).divisionId ?? (data as any).division?.id;
        const rawCalendarId =
          (data as any).calendarId ?? (data as any).calendar?.id;

        // Security: If not system admin, force the resource to the active company
        const targetCompanyId =
          activeCompanyId !== undefined && activeCompanyId !== 0
            ? activeCompanyId
            : Number((data as any).companyId || resource.company.id);

        const parsedDivisionId = Number(rawDivisionId);
        const parsedCalendarId = Number(rawCalendarId);

        if (
          !Number.isInteger(targetCompanyId) ||
          !Number.isInteger(parsedDivisionId) ||
          !Number.isInteger(parsedCalendarId)
        ) {
          throw new BadRequestException(
            'Invalid companyId, divisionId, or calendarId',
          );
        }

        const companyData = await transactionalEntityManager.findOne(Company, {
          where: { id: targetCompanyId },
        });
        const divisionData = await transactionalEntityManager.findOne(
          Division,
          {
            where: { id: parsedDivisionId },
          },
        );
        const calendarData = await transactionalEntityManager.findOne(
          Calendar,
          {
            where: { id: parsedCalendarId },
          },
        );

        if (!companyData || !divisionData) {
          throw new HttpException(
            'Company or Division not found',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!calendarData) {
          // Check if company has ANY calendars
          const hasAnyCalendar = await transactionalEntityManager.count(
            Calendar,
            {
              where: { company: { id: targetCompanyId } },
            },
          );

          if (hasAnyCalendar === 0) {
            throw new HttpException(
              'No calendars found for this company. Please create a calendar before activating resources',
              HttpStatus.BAD_REQUEST,
            );
          }

          throw new HttpException(
            'Selected calendar not found',
            HttpStatus.BAD_REQUEST,
          );
        }

        // Update base fields
        resource.first_name = data.first_name;
        resource.last_name = data.last_name;
        // Normalized to keep the resource<->user email join case-insensitive.
        resource.email = data.email ? normalizeEmail(data.email) : data.email;
        resource.mobile = data.mobile;
        resource.working_hours = data.working_hours;
        resource.company = companyData;
        resource.division = divisionData;
        resource.calendar = calendarData;
        resource.updatedBy = authUser.email;
        if (data.type !== undefined) {
          resource.type = data.type;
        }
        const oldReportingPersonId = resource.reportingPersonId;
        const newReportingPersonId = data.reportingPersonId && Number(data.reportingPersonId) !== 0
          ? Number(data.reportingPersonId)
          : null;
        const updateAll = data.update_all_under_old_reporting_person !== undefined
          ? String(data.update_all_under_old_reporting_person) === 'true'
          : false;

        if (updateAll && oldReportingPersonId && oldReportingPersonId !== newReportingPersonId) {
          await transactionalEntityManager.update(
            Resource,
            { reportingPersonId: oldReportingPersonId, companyId: targetCompanyId },
            { reportingPersonId: newReportingPersonId }
          );
        }

        resource.reportingPersonId = newReportingPersonId;
        resource.active_status =
          data.active_status !== undefined
            ? String(data.active_status) === 'true'
            : true;
        if (file) {
          resource.profile_pic = await uploadToAzure(
            file,
            resource.id as number,
          );
        }

        await transactionalEntityManager.save(Resource, resource);

        await transactionalEntityManager.delete(ResourceSkill, {
          resource: { id: resource.id },
        });

        let skillsArray = data.skills || [];
        if (typeof skillsArray === 'string') {
          try {
            skillsArray = JSON.parse(skillsArray);
          } catch (error) {
            throw new BadRequestException(
              'Skills must be a valid JSON string or array',
            );
          }
        }

        for (const skillData of skillsArray) {
          const parsedSkillId = Number(
            skillData.skill?.id ?? (skillData as any).skillId,
          );
          const parsedSkillLevelId = Number(
            skillData.skillLevel?.id ?? (skillData as any).skillLevelId,
          );
          const parsedSkillCategoryId = Number(
            skillData.skillCategory?.id ?? (skillData as any).skillCategoryId,
          );

          if (
            !Number.isInteger(parsedSkillId) ||
            !Number.isInteger(parsedSkillLevelId) ||
            !Number.isInteger(parsedSkillCategoryId)
          ) {
            throw new BadRequestException(
              'Invalid skill, skillLevel, or skillCategory id',
            );
          }

          const skill = await transactionalEntityManager.findOne(Skill, {
            where: { id: parsedSkillId },
          });
          const skillLevel = await transactionalEntityManager.findOne(
            SkillLevel,
            {
              where: { id: parsedSkillLevelId },
            },
          );
          const skillCategory = await transactionalEntityManager.findOne(
            SkillCategories,
            {
              where: { id: parsedSkillCategoryId },
            },
          );

          if (!skill || !skillLevel || !skillCategory) {
            throw new HttpException(
              'Skill, SkillLevel, or SkillCategory not found',
              HttpStatus.BAD_REQUEST,
            );
          }

          const resourceSkill = transactionalEntityManager.create(
            ResourceSkill,
            {
              resource,
              resourceId: resource.id,
              skill,
              skillId: skill.id,
              skillName: skill.name,
              skillLevel,
              skillLevelId: skillLevel.id,
              skillLevelName: skillLevel.name,
              starCount: skillLevel.star_count,
              skillCategory,
              skillCategoryId: skillCategory.id,
              skillCategoryName: skillCategory.name,
              companyId: targetCompanyId,
            },
          );

          await transactionalEntityManager.save(ResourceSkill, resourceSkill);
        }

        // Handle optional resource cost (upsert)
        const rawCostData = (data as any).resourceCost;
        let costData = rawCostData;
        if (typeof rawCostData === 'string') {
          try {
            costData = JSON.parse(rawCostData);
          } catch {
            costData = null;
          }
        }

        if (costData && costData.cost !== undefined) {
          // Try to find existing cost record for this resource
          let existingCost = await transactionalEntityManager.findOne(
            ResourceCost,
            { where: { resourceId: resource.id } },
          );

          let currency: Currency | null = null;
          if (costData.currencyId) {
            currency = await transactionalEntityManager.findOne(Currency, {
              where: { id: Number(costData.currencyId) },
            });
            if (!currency) {
              throw new HttpException(
                `Currency with id ${costData.currencyId} not found`,
                HttpStatus.BAD_REQUEST,
              );
            }
          }

          if (existingCost) {
            // Update existing cost record
            existingCost.cost = costData.cost;
            existingCost.currency = currency ?? existingCost.currency;
            existingCost.rate_type =
              costData.rate_type ?? existingCost.rate_type;
            existingCost.updatedBy = authUser.email;
            await transactionalEntityManager.save(ResourceCost, existingCost);
          } else {
            // Create new cost record
            const newCost = transactionalEntityManager.create(ResourceCost, {
              resource,
              cost: costData.cost,
              currency: currency ?? undefined,
              rate_type: costData.rate_type,
              createdBy: authUser.email,
            });
            await transactionalEntityManager.save(ResourceCost, newCost);
          }
        }

        return resource;
      },
    );

    await this.invalidateTaskSpaceCachesForResource(updatedResource?.id ?? id);
    return updatedResource;
  }

  async quickEdit(
    id: number,
    field: string,
    value: any,
    authUser: any,
    activeCompanyId?: number,
  ) {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const where: any = { id };
        if (activeCompanyId && activeCompanyId !== 0) {
          where.company = { id: activeCompanyId };
        }

        const resource = await transactionalEntityManager.findOne(Resource, {
          where,
        });

        if (!resource) {
          throw new NotFoundException('Resource not found');
        }

        // 1. Handle Relational Fields (Division, Calendar, etc.)
        const relationalFields = ['division', 'calendar', 'company'];

        if (relationalFields.includes(field)) {
          const entityMap = {
            division: Division,
            calendar: Calendar,
            company: Company,
          };

          const entityMetadata = entityMap[field];
          const relatedEntity = await transactionalEntityManager.findOne(
            entityMetadata,
            {
              where: { id: Number(value) },
            },
          );

          if (!relatedEntity) {
            throw new BadRequestException(
              `${field} with id ${value} not found`,
            );
          }

          resource[field] = relatedEntity;
        }

        // 2. Handle Simple Text/Number Fields
        else {
          // Basic validation: Check if the field actually exists on the entity
          if (!(field in resource)) {
            throw new BadRequestException(
              `Field ${field} does not exist on Resource`,
            );
          }
          resource[field] = value;
        }

        resource.updatedBy = authUser.email;

        return await transactionalEntityManager.save(Resource, resource);
      },
    );
  }

  async getAllResources(activeCompanyId?: number) {
    const where: any = {};
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const resources = await this.entityManager.find(Resource, {
      where,
      order: { updatedAt: 'DESC' },
      relations: {
        company: true,
        division: true,
        resourceSkills: {
          skill: true,
          skillLevel: true,
          skillCategory: true,
        },
        calendar: true,
      },
    });

    // Optional: Map to cleaner structure
    return resources.map((resource) => ({
      id: resource.id,
      first_name: resource.first_name,
      last_name: resource.last_name,
      email: resource.email,
      working_hours: resource.working_hours,
      profile_pic: resource.profile_pic,
      calendar: resource.calendar,
      // resource_pool: resource.resource_pool
      //   ? {
      //       id: resource.resource_pool.id,
      //       resource_pool: resource.resource_pool.resource_pool,
      //       pool_owner: resource.resource_pool.pool_owner
      //         ? {
      //             id: resource.resource_pool.pool_owner.id,
      //             name:
      //               resource.resource_pool.pool_owner.first_name +
      //               ' ' +
      //               resource.resource_pool.pool_owner.last_name,
      //             email: resource.resource_pool.pool_owner.email,
      //           }
      //         : null,
      //     }
      //   : null,
      company: resource.company
        ? { id: resource.company.id, name: resource.company.company }
        : null,
      division: resource.division
        ? { id: resource.division.id, name: resource.division.division }
        : null,
      skills: resource.resourceSkills.map((rs) => ({
        skill: {
          id: rs.skillId ?? rs.skill?.id,
          name: rs.skillName ?? rs.skill?.name,
        },
        level: {
          id: rs.skillLevelId ?? rs.skillLevel?.id,
          name: rs.skillLevelName ?? rs.skillLevel?.name,
        },
        skillCategory: rs.skillCategoryName
          ? {
              id: rs.skillCategoryId ?? rs.skillCategory?.id,
              name: rs.skillCategoryName,
            }
          : rs.skillCategory,
      })),
      active_status: resource.active_status,
      reportingPersonId: resource.reportingPersonId,
      type: resource.type,
    }));
  }

  async getAllResourcesByCompany(companyId: number, divisionId: number) {
    const resources = await this.entityManager.find(Resource, {
      where: {
        company: { id: companyId },
        division: { id: divisionId },
      },
      order: { updatedAt: 'DESC' },
      relations: {
        company: true,
        division: true,
        // resource_pool: {
        //   pool_owner: true,
        //   company: true,
        //   division: true,
        // },
        resourceSkills: {
          skill: true,
          skillLevel: true,
          skillCategory: true,
        },
        calendar: true,
      },
    });

    // Optional: Map to cleaner structure
    return resources.map((resource) => ({
      id: resource.id,
      first_name: resource.first_name,
      last_name: resource.last_name,
      email: resource.email,
      working_hours: resource.working_hours,
      profile_pic: resource.profile_pic,
      calendar: resource.calendar,
      // resource_pool: resource.resource_pool
      //   ? {
      //       id: resource.resource_pool.id,
      //       resource_pool: resource.resource_pool.resource_pool,
      //       pool_owner: resource.resource_pool.pool_owner
      //         ? {
      //             id: resource.resource_pool.pool_owner.id,
      //             name:
      //               resource.resource_pool.pool_owner.first_name +
      //               ' ' +
      //               resource.resource_pool.pool_owner.last_name,
      //             email: resource.resource_pool.pool_owner.email,
      //           }
      //         : null,
      //     }
      //   : null,
      company: resource.company
        ? { id: resource.company.id, name: resource.company.company }
        : null,
      division: resource.division
        ? {
            id: resource.division.id,
            name: resource.division.division,
            division_code: resource.division.division_code,
          }
        : null,
      skills: resource.resourceSkills.map((rs) => ({
        skill: {
          id: rs.skillId ?? rs.skill?.id,
          name: rs.skillName ?? rs.skill?.name,
        },
        level: {
          id: rs.skillLevelId ?? rs.skillLevel?.id,
          name: rs.skillLevelName ?? rs.skillLevel?.name,
        },
        skillCategory: rs.skillCategoryName
          ? {
              id: rs.skillCategoryId ?? rs.skillCategory?.id,
              name: rs.skillCategoryName,
            }
          : rs.skillCategory,
      })),
      active_status: resource.active_status,
      reportingPersonId: resource.reportingPersonId,
      type: resource.type,
    }));
  }

  async getAllResourcesByCompanyOnly(companyId: number) {
    const resources = await this.entityManager.find(Resource, {
      where: {
        company: { id: companyId },
      },
      order: { updatedAt: 'DESC' },
      relations: {
        company: true,
        division: true,
        resourceSkills: {
          skill: true,
          skillLevel: true,
          skillCategory: true,
        },
        calendar: true,
      },
    });

    // Map to structure with resourceSkills (not skills) to match frontend expectations
    return resources.map((resource) => ({
      id: resource.id,
      first_name: resource.first_name,
      last_name: resource.last_name,
      email: resource.email,
      working_hours: resource.working_hours,
      profile_pic: resource.profile_pic,
      calendar: resource.calendar,
      company: resource.company
        ? { id: resource.company.id, name: resource.company.company }
        : null,
      division: resource.division
        ? {
            id: resource.division.id,
            name: resource.division.division,
            division_code: resource.division.division_code,
          }
        : null,
      resourceSkills: resource.resourceSkills.map((rs) => ({
        skill: {
          id: rs.skillId ?? rs.skill?.id,
          name: rs.skillName ?? rs.skill?.name,
        },
        skillLevel: {
          id: rs.skillLevelId ?? rs.skillLevel?.id,
          name: rs.skillLevelName ?? rs.skillLevel?.name,
          star_count: rs.starCount ?? rs.skillLevel?.star_count,
        },
        skillCategory: {
          id: rs.skillCategoryId ?? rs.skillCategory?.id,
          name: rs.skillCategoryName ?? rs.skillCategory?.name,
        },
      })),
      active_status: resource.active_status,
      reportingPersonId: resource.reportingPersonId,
      type: resource.type,
    }));
  }

  async getMyDirectReports(userEmail: string, companyId?: number): Promise<any[]> {
    // Step 1: Find the logged user's resource by email
    const myResourceWhere: any = { email: normalizeEmail(userEmail) };
    if (companyId && companyId !== 0) myResourceWhere.companyId = companyId;

    const myResource = await this.entityManager.findOne(Resource, {
      where: myResourceWhere,
      select: ['id'],
    });

    if (!myResource) return [];

    // Step 2: Get distinct resources that have submitted pulse weeks to this resource
    const rows: { userEmail: string; userFullName: string; userProfilePicture: string }[] =
      await this.entityManager
        .getRepository(PulseWeek)
        .createQueryBuilder('pw')
        .select('pw.userEmail', 'userEmail')
        .addSelect('pw.userFullName', 'userFullName')
        .addSelect('pw.userProfilePicture', 'userProfilePicture')
        .where('pw.submittedToId = :submittedToId', { submittedToId: myResource.id })
        .groupBy('pw.userEmail')
        .addGroupBy('pw.userFullName')
        .addGroupBy('pw.userProfilePicture')
        .orderBy('pw.userFullName', 'ASC')
        .getRawMany();

    return rows.map((r) => {
      const parts = (r.userFullName ?? '').trim().split(' ');
      return {
        email: r.userEmail,
        first_name: parts[0] ?? '',
        last_name: parts.slice(1).join(' '),
        profile_pic: r.userProfilePicture ?? null,
      };
    });
  }

  async findOne(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const resource = await this.entityManager.findOne(Resource, {
      where,
      relations: {
        company: true,
        division: true,
        // resource_pool: {
        //   pool_owner: true,
        // },
        calendar: true,
        reportingPerson: true,
        resourceSkills: {
          skill: true,
          skillLevel: true,
          skillCategory: true,
        },
        resourceCost: {
          currency: true,
        },
      },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }

    // Optional: Format response structure
    return {
      id: resource.id,
      first_name: resource.first_name,
      last_name: resource.last_name,
      email: resource.email,
      mobile: resource.mobile,
      profile_pic: resource.profile_pic,
      active_status: resource.active_status,
      reportingPersonId: resource.reportingPersonId,
      type: resource.type,
      reportingPerson: resource.reportingPerson
        ? {
            id: resource.reportingPerson.id,
            first_name: resource.reportingPerson.first_name,
            last_name: resource.reportingPerson.last_name,
            email: resource.reportingPerson.email,
          }
        : null,
      // resource_pool: resource.resource_pool
      //   ? {
      //       id: resource.resource_pool.id,
      //       resource_pool: resource.resource_pool.resource_pool,
      //       pool_owner: resource.resource_pool.pool_owner
      //         ? {
      //             id: resource.resource_pool.pool_owner.id,
      //             first_name:
      //               resource.resource_pool.pool_owner.first_name +
      //               ' ' +
      //               resource.resource_pool.pool_owner.last_name,
      //             last_name: resource.resource_pool.pool_owner.last_name,
      //             email: resource.resource_pool.pool_owner.email,
      //           }
      //         : null,
      //     }
      //   : null,
      working_hours: resource.working_hours,
      calendar: resource.calendar,
      company: resource.company
        ? { id: resource.company.id, company: resource.company.company }
        : null,
      division: resource.division
        ? {
            id: resource.division.id,
            division: resource.division.division,
            division_code: resource.division.division_code,
          }
        : null,
      skills: resource.resourceSkills.map((rs) => ({
        skill: {
          id: rs.skillId ?? rs.skill?.id,
          name: rs.skillName ?? rs.skill?.name,
        },
        level: {
          id: rs.skillLevelId ?? rs.skillLevel?.id,
          name: rs.skillLevelName ?? rs.skillLevel?.name,
          star_count: rs.starCount ?? rs.skillLevel?.star_count,
        },
        skillCategory: rs.skillCategoryName
          ? {
              id: rs.skillCategoryId ?? rs.skillCategory?.id,
              name: rs.skillCategoryName,
            }
          : rs.skillCategory,
      })),
      resourceCost: resource.resourceCost,
    };
  }

  async getResourceSkills(
    resourceId: number,
    count: number,
    activeCompanyId?: number,
  ) {
    const where: any = { id: resourceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const resource = await this.entityManager.findOne(Resource, {
      where,
      relations: ['resourceSkills'],
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // Sort skills by star_count in descending order (highest first)
    const sortedSkills = resource.resourceSkills.sort((a, b) => {
      const aStars = a.starCount ?? a.skillLevel?.star_count ?? 0;
      const bStars = b.starCount ?? b.skillLevel?.star_count ?? 0;
      return bStars - aStars;
    });

    // Return all skills if count is -1, otherwise return top N skills
    if (count === -1) {
      return sortedSkills;
    }

    return sortedSkills.slice(0, count);
  }

  async disable(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const resource = await this.entityManager.findOne(Resource, {
      where,
    });

    if (!resource) {
      throw new NotFoundException(`Pool with ID ${id} not found`);
    }

    const newIsActiveStatus = !resource.active_status;

    await this.entityManager.update(Resource, id, {
      active_status: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    return {
      message: `Resource Pool status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async remove(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const resource = await this.entityManager.findOne(Resource, { where });
    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    const resourcePoolRepository =
      this.entityManager.getRepository(ResourcePool);

    const resourceSkillRepository =
      this.entityManager.getRepository(ResourceSkill); // Add this back

    // 2. Concurrently check for BLOCKING relationships
    const [associatedPoolsCount] = await Promise.all([
      resourcePoolRepository
        .createQueryBuilder('pool')
        .innerJoin('pool.resources', 'resource')
        .where('resource.id = :id', { id })
        .getCount(),
    ]);

    // 3. Blocking Logic
    const totalBlockingRecords = associatedPoolsCount;

    if (totalBlockingRecords > 0) {
      const errorDetails: string[] = [];
      if (associatedPoolsCount > 0)
        errorDetails.push(
          `- Member of ${associatedPoolsCount} Resource Pool(s)`,
        );

      return {
        error: 'Cannot delete resource due to active relationships',
        message: `Cannot delete Resource. It is currently linked to:\n${errorDetails.join('\n')}\n\nPlease remove the resource from these records first`,
        status: 400,
      };
    }

    // 4. FIX: Manually delete Child Dependencies (Skills)
    // This removes the "Foreign Key constraint" blocker
    await resourceSkillRepository.delete({ resource: { id } });

    // 5. Now it is safe to delete the Resource
    await this.entityManager.delete(Resource, id);

    return {
      message: 'Resource deleted',
      status: 200,
    };
  }

  async getResourceActiveCounts(id: number, activeCompanyId?: number) {
    // const where: any = { id };
    // if (activeCompanyId && activeCompanyId !== 0) {
    //   where.company = { id: activeCompanyId };
    // }

    const resource = await this.entityManager.findOne(Resource, {
      where: {
        id,
        companyId: activeCompanyId,
      },
      // relations: ['projectGroups'],
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // const projectCount = resource.projectGroups?.length || 0;

    const taskCount = await this.entityManager.count(Task, {
      where: {
        companyId: activeCompanyId,
        assigneeId: id,
        statusBase: In([StatusBaseEnum.TOSTART, StatusBaseEnum.PROCESSING]),
      },
    });

    // const user = await this.entityManager.findOne(User, {
    //   where: {
    //     email: ILike(resource.email.trim()),
    //     companies: { id: activeCompanyId },
    //   },
    // });

    let ticketCount = 0;
    if (resource.email) {
      ticketCount = await this.entityManager.count(Ticket, {
        where: {
          assigneeEmail: resource.email,
          companyId: activeCompanyId,
          statusBase: In([StatusBaseEnum.TOSTART, StatusBaseEnum.PROCESSING]),
        },
      });
    }

    return {
      // projectCount,
      taskCount,
      ticketCount,
    };
  }

  /** Search resources with skills included for filtering */
  async searchResourcesWithSkills(
    query?: string,
    rows: number = 10,
    companyId?: number,
  ) {
    const qb = this.entityManager
      .getRepository(Resource)
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.resourceSkills', 'rs')
      .leftJoinAndSelect('rs.skill', 'skill')
      .take(rows)
      .orderBy('resource.id', 'DESC');

    if (companyId) {
      qb.andWhere('resource.companyId = :companyId', { companyId });
    }

    if (query?.trim()) {
      qb.andWhere(
        new Brackets((innerQb) => {
          innerQb.where(
            'resource.first_name ILIKE :q OR resource.last_name ILIKE :q OR resource.email ILIKE :q OR skill.name ILIKE :q',
            { q: `%${query.trim()}%` },
          );
        }),
      );
    }

    const resources = await qb.getMany();
    return resources.map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      profile_pic: r.profile_pic,
      skills: (r.resourceSkills ?? [])
        .map((rs: any) => (rs.skill as { name?: string } | null)?.name)
        .filter((s): s is string => Boolean(s)),
    }));
  }
  /** Sync a resource's basic profile fields from the matching active user account.
   *  Only first_name, last_name, mobile, and profile_pic are updated.
   *  Skills, division, calendar, and all other relations are left untouched. */
  async syncUserData(resourceId: number, authUser: any, activeCompanyId?: number) {
    // 1. Load the resource
    const where: any = { id: resourceId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }
    const resource = await this.entityManager.findOne(Resource, { where });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // 2. Find a matching active user by email
    const userWhere: any = {
      email: normalizeEmail(resource.email),
      isActive: true,
    };
    if (activeCompanyId && activeCompanyId !== 0) {
      userWhere.companies = { id: activeCompanyId };
    }
    const user = await this.entityManager.findOne(User, {
      where: userWhere,
      relations: ['companies'],
    });

    if (!user) {
      throw new NotFoundException(
        'No active user found with the same email address',
      );
    }

    // 3. Patch only the profile fields
    if (user.first_name) resource.first_name = user.first_name;
    if (user.last_name) resource.last_name = user.last_name;
    if (user.mobile_number) resource.mobile = Number(user.mobile_number) || resource.mobile;
    if (user.profile_picture) resource.profile_pic = user.profile_picture;
    resource.updatedBy = authUser?.email ?? 'system';

    await this.entityManager.save(Resource, resource);

    return {
      message: 'Resource synced with user',
      status: 200,
    };
  }
}
