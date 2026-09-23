import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { EntityManager, In } from 'typeorm';
import { ResponseCompanyDto } from './dto/company.dto';
import { ActiveStatus } from '../../common/enum/status.enum';
import { EmailProvider } from '../../common/enum/email-provider.enum';
import { UserCompanyView } from '../../user-management/user/user-company-view/user-company.entity';
import { User } from '../../user-management/user/user.entity';
import { uploadToAzureCompanyLogo } from '../../common/azure/azure-image-upload';
import { RedisService } from '../../redis/redis.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { MeetingProvider } from '../../meetings-integration/entities/meeting-integration-connection.entity';

@Injectable()
export class CompanyService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly redisService: RedisService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async syncUserCompaniesCache(userId: number) {
    const userCompanies = await this.entityManager.find(UserCompanyView, {
      where: { userId },
    });
    await this.redisService.setUserCompanies(userId, userCompanies);
  }

  getAllCompany(activeCompanyId?: number): Promise<ResponseCompanyDto[]> {
    const where: any = { isActive: ActiveStatus.ACTIVE };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.id = activeCompanyId;
    }

    return this.entityManager.find(Company, {
      where,
      order: { id: 'asc' },
    });
  }

  async getCompaniesForUser(userId: number): Promise<UserCompanyView[]> {
    return await this.entityManager
      .createQueryBuilder(UserCompanyView, 'uc')
      .where('uc."userId" = :userId', { userId })
      .getMany();
  }

  async getCompanyById(
    id: number,
    activeCompanyId?: number,
  ): Promise<ResponseCompanyDto> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.id = activeCompanyId;
    }

    const company = await this.entityManager.findOne(Company, {
      where,
      relations: ['divisions'],
    });
    if (!company) {
      throw new HttpException(
        `Company with id ${id} not found`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return company;
  }

  async createCompany(company: any, authUser: any, file?: Express.Multer.File) {
    const { users: userIdsRaw, ...companyData } = company;
    const newCompanyData: Partial<Company> = { ...companyData };
    let userIds: number[] = [];

    if (newCompanyData.id == null || newCompanyData.id == 0) {
      delete newCompanyData.id;
    }
    newCompanyData.createdBy = authUser.email;
    newCompanyData.isActive = ActiveStatus.ACTIVE;

    if (typeof userIdsRaw === 'string') {
      try {
        const parsed = JSON.parse(userIdsRaw);
        if (Array.isArray(parsed)) {
          userIds = parsed.map((id) => parseInt(id, 10));
        }
      } catch (e) {
        throw new Error('User IDs provided in invalid format.');
      }
    } else if (Array.isArray(userIdsRaw)) {
      userIds = userIdsRaw;
    }

    let savedCompany = await this.entityManager.save(Company, newCompanyData);

    if (file) {
      const imageUrl = await uploadToAzureCompanyLogo(
        file,
        savedCompany.id as number,
      );
      savedCompany.logo = imageUrl;

      savedCompany = await this.entityManager.save(Company, savedCompany);
    }

    if (userIds.length > 0) {
      try {
        const users = await this.entityManager.find(User, {
          where: { id: In(userIds) },
          relations: ['companies'],
        });

        if (users.length > 0) {
          const updatedUsers: User[] = [];

          for (const user of users) {
            if (!user.companies) {
              user.companies = [];
            }

            user.companies.push(savedCompany);
            updatedUsers.push(user);
          }

          await this.entityManager.save(User, updatedUsers);

          // Update cache for assigned users
          for (const userId of userIds) {
            try {
              await this.authorizationService.updateUserCompanyPrivilegesIntoCache(
                userId,
              );
              await this.syncUserCompaniesCache(userId);
            } catch (cacheError) {
              console.error(
                `Error updating cache for user ${userId}:`,
                cacheError,
              );
            }
          }
        }
      } catch (error) {
        throw new Error('An error occurred during user assignment.');
      }
    }

    return savedCompany;
  }

  async updateCompany(
    id: number,
    company: Partial<Company>,
    authUser: any,
    file?: Express.Multer.File,
    activeCompanyId?: number,
  ): Promise<Company> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.id = activeCompanyId;
    }

    const existing = await this.entityManager.findOne(Company, { where });
    if (!existing) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    company.isActive = ActiveStatus.ACTIVE;
    if (file) {
      const imageUrl = await uploadToAzureCompanyLogo(file, id);
      company.logo = imageUrl;
    }
    company.updatedBy = authUser.email;
    await this.entityManager.update(Company, where, company);
    const updated = await this.entityManager.findOne(Company, {
      where: { id },
    });
    return updated!;
  }

  // async getCompaniesForUser(userId: string): Promise<Company[]> {
  //   return this.companyRepository
  //     .createQueryBuilder('company')
  //     .leftJoin('company.users', 'user')
  //     .where('user.id = :userId', { userId })
  //     .andWhere('company.active_status = :active', { active: true })
  //     .getMany();
  // }

  async getNotificationEmailConfig(
    id: number,
    activeCompanyId?: number,
  ): Promise<{
    notificationEmail: string;
    emailProvider: string;
    notificationEmailPassword: string;
  }> {
    let query = this.entityManager
      .createQueryBuilder(Company, 'c')
      .select(['c.id', 'c.notificationEmail', 'c.emailProvider'])
      .addSelect('c.notificationEmailPassword')
      .where('c.id = :id', { id });

    if (activeCompanyId && activeCompanyId !== 0) {
      query = query.andWhere('c.id = :activeCompanyId', { activeCompanyId });
    }

    const company = await query.getOne();
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    return {
      notificationEmail: company.notificationEmail ?? '',
      emailProvider: company.emailProvider ?? '',
      notificationEmailPassword: company.notificationEmailPassword ?? '',
    };
  }

  async updateNotificationEmail(
    id: number,
    data: {
      notificationEmail: string;
      emailProvider: string;
      notificationEmailPassword?: string;
    },
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Company> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.id = activeCompanyId;
    }

    const existing = await this.entityManager.findOne(Company, { where });
    if (!existing) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    const updatePayload: Partial<Company> & { updatedBy: string } = {
      notificationEmail: data.notificationEmail,
      emailProvider:
        (data.emailProvider as EmailProvider) ?? EmailProvider.MAIL_SERVICE,
      updatedBy: authUser.email,
    };
    if (data.notificationEmailPassword) {
      updatePayload.notificationEmailPassword = data.notificationEmailPassword;
    }
    await this.entityManager.update(Company, where, updatePayload);
    const updated = await this.entityManager.findOne(Company, {
      where: { id },
    });
    return updated!;
  }

  async updateMeetingProviders(
    id: number,
    providers: MeetingProvider[],
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Company> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.id = activeCompanyId;
    }

    const existing = await this.entityManager.findOne(Company, { where });
    if (!existing) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    const updatePayload: Partial<Company> & { updatedBy: string } = {
      allowedMeetingProviders: providers,
      updatedBy: authUser.email,
    };

    await this.entityManager.update(Company, where, updatePayload);
    const updated = await this.entityManager.findOne(Company, {
      where: { id },
    });
    return updated!;
  }

  async deleteCompany(id: number, authUser: any, activeCompanyId?: number) {
    const targetId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : id;

    const existing = await this.entityManager.findOne(Company, {
      where: { id: targetId },
      relations: [
        'users',
        'divisions',
        'calendars',
        'resources',
        'resourcepools',
        'userCompanyRoles',
        'roles',
      ],
    });
    if (!existing) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    // 2. Check if any associated entities exist
    const activeRelations: string[] = [];
    if (existing.users && existing.users.length > 0) activeRelations.push('users');
    if (existing.divisions && existing.divisions.length > 0) activeRelations.push('divisions');
    if (existing.calendars && existing.calendars.length > 0) activeRelations.push('calendars');
    if (existing.resources && existing.resources.length > 0) activeRelations.push('resources');
    if (existing.resourcepools && existing.resourcepools.length > 0) activeRelations.push('resourcepools');
    if (existing.userCompanyRoles && existing.userCompanyRoles.length > 0) activeRelations.push('userCompanyRoles');
    if (existing.roles && existing.roles.length > 0) activeRelations.push('roles');

    // 3. Perform hard delete if clean, or soft delete if relations exist
    if (activeRelations.length > 0) {
      await this.entityManager.update(
        Company,
        { id: targetId },
        {
          isActive: ActiveStatus.BLOCK,
          updatedBy: authUser.email,
        },
      );
      return {
        message: `Company deactivated due to existing associated data: ${activeRelations.join(', ')}`,
      };
    }

    await this.entityManager.delete(Company, targetId);
    return { message: 'Company permanently deleted' };
  }
}
