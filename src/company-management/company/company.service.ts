import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { EntityManager, In, FindOptionsWhere } from 'typeorm';
import { ResponseCompanyDto } from './dto/company.dto';
import { ActiveStatus } from '../../common/enum/status.enum';
import { UserRegistrationSource } from '../../common/enum/user-registration-source.enum';
import { UserCompanyView } from '../../user-management/user/user-company-view/user-company.entity';
import { User } from '../../user-management/user/user.entity';
import { uploadToAzureCompanyLogo } from '../../common/azure/azure-image-upload';
import { RedisService } from '../../redis/redis.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { MeetingProvider } from '../../meetings-integration/entities/meeting-integration-connection.entity';
import { generateUniqueCompanyCode } from '../../common/utils/company-code.util';

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

  async getAllCompany(activeCompanyId?: number): Promise<ResponseCompanyDto[]> {
    const qb = this.entityManager
      .createQueryBuilder(Company, 'company')
      .leftJoin(
        User,
        'creator',
        'company.is_self_registered_company = :isSelfRegistered AND (creator.email = company.createdBy OR CAST(creator.id AS TEXT) = company.createdBy)',
        { isSelfRegistered: true },
      )
      .leftJoin(
        'company.users',
        'selfRegUser',
        'company.is_self_registered_company = :isSelfRegistered AND selfRegUser.registrationSource = :selfRegSource',
        {
          isSelfRegistered: true,
          selfRegSource: UserRegistrationSource.SELF_REGISTERED,
        },
      )
      .addSelect(['creator.email', 'selfRegUser.id', 'selfRegUser.email'])
      .where('company.isActive = :isActive', { isActive: ActiveStatus.ACTIVE });

    if (activeCompanyId && activeCompanyId !== 0) {
      qb.andWhere('company.id = :activeCompanyId', { activeCompanyId });
    }

    qb.orderBy('company.id', 'ASC');

    const { entities, raw } = await qb.getRawAndEntities();

    return entities.map((company) => {
      const isSelfCreated = Boolean(company.is_self_registered_company);
      const rawRow = raw.find(
        (r: Record<string, unknown>) => r.company_id === company.id,
      );
      const fallbackUserEmail = company.users?.[0]?.email;
      const creatorEmail = isSelfCreated
        ? ((rawRow?.creator_email as string | undefined) ||
            (rawRow?.selfRegUser_email as string | undefined) ||
            fallbackUserEmail ||
            company.createdBy ||
            null)
        : null;

      const { users: _users, ...companyWithoutUsers } = company;

      return {
        ...companyWithoutUsers,
        users: [],
        is_self_registered_company: isSelfCreated,
        is_self_created_company: isSelfCreated,
        ...(isSelfCreated && creatorEmail
          ? {
              createdBy: creatorEmail,
              creatorEmail,
              creator: { email: creatorEmail },
            }
          : {}),
      };
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
    const targetId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : id;

    if (activeCompanyId && activeCompanyId !== 0 && activeCompanyId !== id) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    const where: FindOptionsWhere<Company> = { id: targetId };

    const company = await this.entityManager.findOne(Company, {
      where,
      relations: ['divisions'],
    });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
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

    // The company code is always generated server-side (5 letters, unique, based on the name)
    let savedCompany: Company | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      newCompanyData.company_code = await generateUniqueCompanyCode(
        this.entityManager,
        newCompanyData.company as string,
      );
      try {
        savedCompany = await this.entityManager.save(Company, newCompanyData);
        break;
      } catch (error: any) {
        // 23505 = unique_violation (another company took the code concurrently)
        if (error?.code !== '23505' || attempt === 2) throw error;
      }
    }
    if (!savedCompany) {
      throw new HttpException(
        'Unable to generate a unique company code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

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
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : id;

    const where: FindOptionsWhere<Company> = { id: targetCompanyId };

    const existing = await this.entityManager.findOne(Company, { where });
    if (!existing) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }

    // Dynamic privilege check for "Company Edit" (privilege '2')
    const rawPrivileges: Array<{
      companyId?: number | null;
      privilegeIds?: (number | string)[];
    }> = authUser?.privileges || [];

    const hasCompanyEditPrivilege = rawPrivileges.some((p) => {
      const isTargetCompany =
        p.companyId === targetCompanyId || p.companyId === id;
      const isSystem = p.companyId === 0 || p.companyId === null;
      if (isTargetCompany || isSystem) {
        return (p.privilegeIds || []).some((pid) => String(pid) === '2');
      }
      return false;
    });

    const updatePayload: Partial<Company> = {};

    if (hasCompanyEditPrivilege) {
      if (company.company !== undefined) {
        updatePayload.company = company.company;
      }
      if (company.address !== undefined) {
        updatePayload.address = company.address;
      }
      if (company.suspend_on !== undefined) {
        updatePayload.suspend_on = company.suspend_on;
      }
      if (company.isActive !== undefined) {
        updatePayload.isActive = company.isActive;
      }

      if (file) {
        const imageUrl = await uploadToAzureCompanyLogo(file, id);
        updatePayload.logo = imageUrl;
      }
    } else {
      // Non-privileged users: strictly allow updates only to the address column
      if (company.address !== undefined) {
        updatePayload.address = company.address;
      }
    }

    updatePayload.updatedBy = authUser?.email;
    updatePayload.company_code = undefined; // Company code is immutable

    await this.entityManager.update(Company, where, updatePayload);
    const updated = await this.entityManager.findOne(Company, {
      where: { id: targetCompanyId },
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
