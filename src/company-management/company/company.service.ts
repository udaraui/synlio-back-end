import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { EntityManager, In, FindOptionsWhere, QueryFailedError } from 'typeorm';
import { ResponseCompanyDto } from './dto/company.dto';
import { ActiveStatus } from '../../common/enum/status.enum';
import { UserRegistrationSource } from '../../common/enum/user-registration-source.enum';
import { UserCompanyView } from '../../user-management/user/user-company-view/user-company.entity';
import { User } from '../../user-management/user/user.entity';
import { Division } from '../division/division.entity';
import { Calendar } from '../../resource-management/calendar/calendar.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { Role } from '../../user-management/role/role.entity';
import { UserCompanyRole } from '../../user-management/user/user-company-role.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { TicketSpace } from '../../ticket-management/ticket-space/ticket-space.entity';
import { Task } from '../../task-management/task/task.entity';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
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

  async deleteCompany(
    id: number,
    _authUser: Record<string, unknown>,
    activeCompanyId?: number,
  ) {
    const targetId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : id;

    const existing = await this.entityManager.findOne(Company, {
      where: { id: targetId },
      relations: ['users'],
    });
    if (!existing) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    // 1. Check all dependency relationships before attempting deletion
    const [
      divisionsCount,
      calendarsCount,
      resourcesCount,
      resourcePoolsCount,
      rolesCount,
      userCompanyRolesCount,
      taskSpacesCount,
      ticketSpacesCount,
      tasksCount,
      ticketsCount,
    ] = await Promise.all([
      this.entityManager.count(Division, { where: { companyId: targetId } }),
      this.entityManager.count(Calendar, {
        where: { company: { id: targetId } },
      }),
      this.entityManager.count(Resource, { where: { companyId: targetId } }),
      this.entityManager.count(ResourcePool, {
        where: { company: { id: targetId } },
      }),
      this.entityManager.count(Role, { where: { companyId: targetId } }),
      this.entityManager.count(UserCompanyRole, {
        where: { companyId: targetId },
      }),
      this.entityManager.count(TaskSpace, { where: { companyId: targetId } }),
      this.entityManager.count(TicketSpace, { where: { companyId: targetId } }),
      this.entityManager.count(Task, { where: { companyId: targetId } }),
      this.entityManager.count(Ticket, { where: { companyId: targetId } }),
    ]);

    const usersCount = existing.users?.length ?? 0;
    const blockingReasons: string[] = [];

    if (usersCount > 0) {
      blockingReasons.push(`${usersCount} assigned user(s)`);
    }
    if (divisionsCount > 0) {
      blockingReasons.push(`${divisionsCount} division(s)`);
    }
    if (rolesCount > 0) {
      blockingReasons.push(`${rolesCount} role(s)`);
    }
    if (userCompanyRolesCount > 0 && usersCount === 0) {
      blockingReasons.push(`${userCompanyRolesCount} user role assignment(s)`);
    }
    if (calendarsCount > 0) {
      blockingReasons.push(`${calendarsCount} calendar(s)`);
    }
    if (resourcesCount > 0) {
      blockingReasons.push(`${resourcesCount} resource(s)`);
    }
    if (resourcePoolsCount > 0) {
      blockingReasons.push(`${resourcePoolsCount} resource pool(s)`);
    }
    if (taskSpacesCount > 0) {
      blockingReasons.push(`${taskSpacesCount} task space(s)`);
    }
    if (ticketSpacesCount > 0) {
      blockingReasons.push(`${ticketSpacesCount} ticket space(s)`);
    }
    if (tasksCount > 0) {
      blockingReasons.push(`${tasksCount} task(s)`);
    }
    if (ticketsCount > 0) {
      blockingReasons.push(`${ticketsCount} ticket(s)`);
    }

    if (blockingReasons.length > 0) {
      throw new ConflictException({
        status: 409,
        error: 'Deletion Blocked',
        message: `Cannot delete company "${existing.company}" because it is currently linked to ${blockingReasons.join(', ')}. Please remove or reassign these records first.`,
        counts: {
          usersCount,
          divisionsCount,
          rolesCount,
          userCompanyRolesCount: usersCount === 0 ? userCompanyRolesCount : 0,
          calendarsCount,
          resourcesCount,
          resourcePoolsCount,
          taskSpacesCount,
          ticketSpacesCount,
          tasksCount,
          ticketsCount,
        },
      });
    }

    // 2. Attempt hard deletion with foreign key violation protection
    try {
      await this.entityManager.delete(Company, targetId);
      return { message: `Company "${existing.company}" permanently deleted.` };
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as
          | { code?: string; detail?: string; table?: string }
          | undefined;
        if (driverError?.code === '23503') {
          const tableDetail = driverError.table
            ? ` (referenced in "${driverError.table}")`
            : '';
          throw new ConflictException(
            `Cannot delete company "${existing.company}" because it still has dependent records${tableDetail}. Please remove all associated records before deleting the company.`,
          );
        }
      }
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : `Failed to delete company "${existing.company}".`,
      );
    }
  }
}
