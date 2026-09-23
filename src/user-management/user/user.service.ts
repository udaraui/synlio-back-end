import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { User } from './user.entity';
import { UserCompanyRole } from './user-company-role.entity';
import { EntityManager, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserCompanyPrivilegeView } from './user-company-privilege-view/user-company-privilege.entity';
import { UserCompanyView } from './user-company-view/user-company.entity';
import { CreateUserDto } from './dto/user.dto';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { Role } from '../role/role.entity';
import { RedisService } from '../../redis/redis.service';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { uploadToAzure } from '../../common/azure/azure-image-upload';
import { normalizeEmail } from '../../common/email/email-normalize.helper';
import { Resource } from '../../resource-management/resource/resource.entity';
import { Calendar } from '../../resource-management/calendar/calendar.entity';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Task } from '../../task-management/task/task.entity';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { TicketSpaceMember } from '../../ticket-management/ticket-space-member/ticket-space-member.entity';
import { ResourceSkill } from '../../resource-management/resource/resource-skill.entity';
import { PulseWeek } from '../../pulse/pulse-week.entity';

@Injectable()
export class UserService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async syncUserCompaniesCache(userId: number) {
    const userCompanies = await this.entityManager.find(UserCompanyView, {
      where: { userId },
    });
    await this.redisService.setUserCompanies(userId, userCompanies);
  }

  async createUser(
    createUserDto: CreateUserDto,
    authUser: any,
    file: Express.Multer.File | undefined,
    activeCompanyId?: number,
  ): Promise<User> {
    const savedUserResult = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // Emails are treated case-insensitively: normalize before lookup and
        // storage so "Mayura@gmail.com" and "mayura@gmail.com" are one account.
        const normalizedEmail = normalizeEmail(createUserDto.email);

        // Check if user already exists
        let user = await transactionalEntityManager.findOne(User, {
          where: { email: normalizedEmail },
          relations: ['companies', 'divisions', 'userCompanyRoles'],
        });

        const isExistingUser = !!user;

        if (!user) {
          user = new User();
          user.email = normalizedEmail;
          user.password = await bcrypt.hash(createUserDto.password, 10);
        } else {
          // If user exists and is inactive, reactivate them
          if (!user.isActive) {
            user.isActive = true;
          }
        }

        // Update basic properties (allow updating existing user's info if provided)
        user.first_name = createUserDto.first_name;
        user.last_name = createUserDto.last_name;
        if (createUserDto.phone_number) {
          user.mobile_number = createUserDto.phone_number;
        }
        user.isActive =
          createUserDto.isActive !== undefined
            ? createUserDto.isActive
            : user.isActive;

        if (!isExistingUser) {
          user.createdBy = authUser.email;
        } else {
          user.updatedBy = authUser.email;
        }

        let savedUser = await transactionalEntityManager.save(user);

        if (file) {
          const imageUrl = await uploadToAzure(file, savedUser.id as number);
          savedUser.profile_picture = imageUrl;
          savedUser = await transactionalEntityManager.save(savedUser);
        }

        // Handle Companies
        let newCompanyIds = createUserDto.companyIds;

        // Security: If not system admin, force the user to be created in the active company
        if (activeCompanyId !== undefined && activeCompanyId !== 0) {
          newCompanyIds = [activeCompanyId];
        }

        if (Array.isArray(newCompanyIds)) {
          const existingCompanyIds =
            savedUser.companies?.map((c) => c.id) || [];

          // Merge unique companies
          const combinedCompanies = [...(savedUser.companies || [])];
          for (const id of newCompanyIds) {
            if (!existingCompanyIds.includes(id)) {
              combinedCompanies.push({ id } as Company);
            }
          }
          savedUser.companies = combinedCompanies;

          if (combinedCompanies.length === 1 || !savedUser.defaultCompanyId) {
            savedUser.defaultCompanyId = combinedCompanies[0].id as number;
          }

          savedUser = await transactionalEntityManager.save(savedUser);
        }

        // Handle Divisions
        if (Array.isArray(createUserDto.divisionIds)) {
          const newDivisionIds = createUserDto.divisionIds;
          const existingDivisionIds =
            savedUser.divisions?.map((d) => d.id) || [];

          const combinedDivisions = [...(savedUser.divisions || [])];
          for (const id of newDivisionIds) {
            if (!existingDivisionIds.includes(id)) {
              combinedDivisions.push({ id } as Division);
            }
          }

          savedUser.divisions = combinedDivisions;
          savedUser = await transactionalEntityManager.save(savedUser);
        }

        // Handle Roles
        if (Array.isArray(createUserDto.userCompanyRoles)) {
          // Security: If not system admin, only allow roles for the active company
          if (activeCompanyId !== undefined && activeCompanyId !== 0) {
            createUserDto.userCompanyRoles =
              createUserDto.userCompanyRoles.filter(
                (ucr: any) => ucr.companyId === activeCompanyId,
              );
          }

          const existingRoles = savedUser.userCompanyRoles || [];
          const newRolesToSave: UserCompanyRole[] = [];

          for (const ucr of createUserDto.userCompanyRoles) {
            const alreadyHasRole = existingRoles.some(
              (r) => r.companyId === ucr.companyId && r.roleId === ucr.roleId,
            );

            if (!alreadyHasRole) {
              const entry = new UserCompanyRole();
              entry.userId = savedUser.id as number;
              entry.companyId = ucr.companyId;
              entry.roleId = ucr.roleId;
              newRolesToSave.push(entry);
            }
          }

          if (newRolesToSave.length > 0) {
            await transactionalEntityManager.save(
              UserCompanyRole,
              newRolesToSave,
            );
            savedUser.userCompanyRoles = [...existingRoles, ...newRolesToSave];
          }
        }

        // Automatically create a resource if one doesn't exist for THIS company
        try {
          // Check if resource exists for this user in the PRIMARY selected company
          const targetCompanyId = createUserDto.companyIds?.[0];

          if (targetCompanyId) {
            const existingResource = await transactionalEntityManager.findOne(
              Resource,
              {
                where: {
                  email: savedUser.email,
                  companyId: targetCompanyId,
                },
              },
            );

            if (!existingResource) {
              const userDivision = savedUser.divisions?.find(
                (d) =>
                  // This is a bit tricky if divisions aren't tied to companies in the join table
                  // but let's assume we take the first division selected in the DTO if it belongs to the company
                  // or just the first one for now as a fallback.
                  true,
              );

              // Find default calendar for the company
              // const defaultCalendar = await transactionalEntityManager.findOne(
              //   Calendar,
              //   {
              //     where: { company: { id: targetCompanyId } },
              //     order: { id: 'ASC' },
              //   },
              // );

              const resource = new Resource();
              resource.first_name = savedUser.first_name;
              resource.last_name = savedUser.last_name;
              resource.email = savedUser.email;
              if (savedUser.id) {
                resource.userId = savedUser.id;
              }
              if (savedUser.mobile_number) {
                resource.mobile = parseInt(savedUser.mobile_number);
              }
              resource.working_hours = 8;
              resource.companyId = targetCompanyId;
              if (createUserDto.divisionIds?.[0]) {
                resource.divisionId = createUserDto.divisionIds[0];
              }
              // if (defaultCalendar) {
              //   resource.calendar = defaultCalendar;
              // }
              if (savedUser.profile_picture) {
                resource.profile_pic = savedUser.profile_picture;
              }
              resource.active_status = false; // Resources must be activated manually after configuration
              resource.createdBy = authUser.email;

              const savedResource = await transactionalEntityManager.save(Resource, resource);

              // Sync profile_pic in case the user's profile_picture was set after
              // the initial user save (e.g. the file was processed in between).
              if (savedUser.profile_picture && !savedResource.profile_pic) {
                savedResource.profile_pic = savedUser.profile_picture;
                await transactionalEntityManager.save(Resource, savedResource);
              }
            }
          }
        } catch (error) {
          console.error('Error creating automatic resource:', error);
        }

        return savedUser;
      },
    );

    // Call authorization caching AFTER transaction is committed
    try {
      await this.authorizationService.updateUserCompanyPrivilegesIntoCache(
        savedUserResult.id as number,
      );
      await this.syncUserCompaniesCache(savedUserResult.id as number);
    } catch (error) {
      console.error('Error updating cache for new user:', error);
    }

    return savedUserResult;
  }

  async updateUser(
    userData: any,
    authUser: any,
    file: Express.Multer.File | undefined,
    activeCompanyId?: number,
  ) {
    const existingUser = await this.entityManager.findOne(User, {
      where: { id: userData.id },
      relations: ['companies', 'divisions', 'userCompanyRoles'],
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // Update basic fields
    existingUser.first_name = userData.first_name;
    existingUser.last_name = userData.last_name;
    if (userData.email) {
      const normalizedEmail = normalizeEmail(userData.email);

      // Guard against editing a user onto an address another account owns.
      if (normalizedEmail !== existingUser.email) {
        const emailOwner = await this.entityManager.findOne(User, {
          where: { email: normalizedEmail },
        });
        if (emailOwner && emailOwner.id !== existingUser.id) {
          throw new BadRequestException(
            'Another account already uses this email address',
          );
        }
      }

      existingUser.email = normalizedEmail;
    }
    existingUser.isActive = userData.isActive;
    existingUser.mobile_number = userData.phone_number;
    if (file) {
      const imageUrl = await uploadToAzure(file, existingUser.id as number);
      existingUser.profile_picture = imageUrl;
    }
    existingUser.updatedBy = authUser.email;

    // Only update password if provided
    if (userData.password && userData.password.trim() !== '') {
      const saltRounds = 10;
      existingUser.password = await bcrypt.hash(userData.password, saltRounds);
    }

    // Update companies
    // if (Array.isArray(userData.companyIds)) {
    //   existingUser.companies = userData.companyIds.map(
    //     (id: number) => ({ id }) as Company,
    //   );
    // }

    // Update divisions
    if (Array.isArray(userData.divisionIds)) {
      existingUser.divisions = userData.divisionIds.map(
        (id: number) => ({ id }) as Division,
      );
    }

    // Update UserCompanyRoles
    if (Array.isArray(userData.userCompanyRoles)) {
      // Normalize role input to numbers and remove invalid entries
      userData.userCompanyRoles = userData.userCompanyRoles
        .filter((ucr: any) => ucr.roleId !== undefined && ucr.roleId !== null)
        .map((ucr: any) => ({
          companyId: Number(ucr.companyId),
          roleId: Number(ucr.roleId),
        }))
        .filter(
          (ucr: any) =>
            ucr.roleId > 0 &&
            !Number.isNaN(ucr.roleId) &&
            (ucr.companyId > 0 ||
              (activeCompanyId !== undefined && activeCompanyId !== 0)),
        );

      // Security: If not system admin, force everything into the active company scope
      if (activeCompanyId !== undefined && activeCompanyId !== 0) {
        userData.userCompanyRoles = userData.userCompanyRoles.map(
          (ucr: any) => ({
            ...ucr,
            companyId: activeCompanyId,
          }),
        );

        await this.entityManager.delete(UserCompanyRole, {
          userId: userData.id,
          companyId: activeCompanyId,
        });
      } else {
        const companiesToUpdate = [
          ...new Set(
            userData.userCompanyRoles.map((ucr: any) => ucr.companyId),
          ),
        ];

        for (const companyId of companiesToUpdate) {
          await this.entityManager.delete(UserCompanyRole, {
            userId: userData.id,
            companyId,
          });
        }
      }

      // Then create new UserCompanyRoles
      const newUserCompanyRoles = userData.userCompanyRoles.map(
        (ucr: { companyId: number; roleId: number }) => {
          const entry = new UserCompanyRole();
          entry.userId = userData.id;
          entry.companyId = ucr.companyId;
          entry.roleId = ucr.roleId;
          entry.company = { id: ucr.companyId } as Company;
          entry.role = { id: ucr.roleId } as Role;
          return entry;
        },
      );

      if (newUserCompanyRoles.length > 0) {
        await this.entityManager.save(UserCompanyRole, newUserCompanyRoles);
      }

      const allUserRoles = await this.entityManager.find(UserCompanyRole, {
        where: { userId: userData.id },
        relations: ['role', 'company'],
      });
      existingUser.userCompanyRoles = allUserRoles;
    }

    // Save the updated user
    const savedUser = await this.entityManager.save(User, existingUser);

    await this.authorizationService.updateUserCompanyPrivilegesIntoCache(
      savedUser.id as number,
    );
    await this.syncUserCompaniesCache(savedUser.id as number);

    // Return the user with all relations loaded
    return await this.entityManager.findOne(User, {
      where: { id: savedUser.id },
      relations: [
        'companies',
        'divisions',
        'userCompanyRoles',
        'userCompanyRoles.role',
        'userCompanyRoles.company',
      ],
    });
  }

  async updateRefreshToken(userId: number, refreshToken: string | undefined) {
    const user = await this.entityManager.findOne(User, {
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }
    if (refreshToken) {
      user.hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    } else {
      user.hashedRefreshToken = undefined;
    }
    await this.entityManager.save(User, user);
    return user.hashedRefreshToken;
  }

  async searchByEmail(email: string, companyId?: number) {
    const where: any = { email: normalizeEmail(email) };

    if (companyId && companyId !== 0) {
      where.companies = { id: companyId };
    }

    return await this.entityManager.findOne(User, {
      where,
      relations: [
        'companies',
        'divisions',
        'userCompanyRoles',
        'userCompanyRoles.role',
        'userCompanyRoles.company',
      ],
    });
  }

  async findOne(email: string): Promise<User | null> {
    return await this.entityManager
      .createQueryBuilder(User, 'user')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .addSelect('user.password')
      .getOne();
  }

  /**
   * Lookup of an active user by email, without selecting the password hash.
   * Emails are stored normalized, so the incoming value is normalized to match.
   */
  async findOneByEmailInsensitive(email: string): Promise<User | null> {
    return await this.entityManager
      .createQueryBuilder(User, 'user')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
  }

  async getUserProfile(userid: number) {
    if (userid == null) {
      userid = 0;
    }
    const output = await this.entityManager.findOne(User, {
      where: { id: userid, isActive: true },
      relations: [
        'groups',
        'divisions',
        'userCompanyRoles',
        'userCompanyRoles.role',
        'userCompanyRoles.role.privileges',
      ],
    });
    if (output) {
      const { password = null, ...user }: any = output;
      return user;
    } else {
      return null;
    }
  }

  async getUserByIdLoggedIn(id: number) {
    const user = await this.entityManager.findOne(User, {
      where: { id: id },
      relations: [
        // 'companies',
        'divisions',
        // 'userCompanyRoles',
        // 'userCompanyRoles.role',
        // 'userCompanyRoles.company',
        // 'userCompanyRoles.role.privileges',
      ],
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        mobile_number: true,
        profile_picture: true,
        isActive: true,
        password: true, // Include password so we can destructure it out
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
      },
    });
    if (!user) {
      return null;
    }

    const { password = null, ...userData }: any = user;

    const divisions = user.divisions;
    const userCompanyRoles = user.userCompanyRoles;
    const roles = userCompanyRoles?.map((ucr) => ucr.role);
    const companies = userCompanyRoles?.map((ucr) => ucr.company);

    return { ...userData, companies, divisions, roles };
  }

  async getUserById(id: number, companyId?: number) {
    const where: any = { id: id };

    // If companyId is provided (and not system scope), ensure user belongs to it
    if (companyId && companyId !== 0) {
      where.companies = { id: companyId };
    }

    const user = await this.entityManager.findOne(User, {
      where,
      relations: [
        'companies',
        'divisions',
        'userCompanyRoles',
        'userCompanyRoles.role',
        'userCompanyRoles.company',
        'userCompanyRoles.role.privileges',
      ],
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        mobile_number: true,
        profile_picture: true,
        isActive: true,
        password: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
      },
    });

    if (!user) {
      return null;
    }

    const { password = null, ...userData }: any = user;

    let userCompanyRoles = user.userCompanyRoles || [];

    // 👇 FIX: Filter the roles array to only include the active company
    if (companyId && companyId !== 0) {
      userCompanyRoles = userCompanyRoles.filter(
        (ucr) => ucr.company?.id === companyId,
      );
    }

    const divisions = user.divisions;

    // These will now ONLY map the roles and companies for the active companyId
    const roles = userCompanyRoles.map((ucr) => ucr.role);
    const companies = userCompanyRoles.map((ucr) => ucr.company);

    // Note: if you wanted to return a distinct list of companies without duplicates,
    // you might want to use the native `user.companies.filter(c => c.id === companyId)` instead.

    return { ...userData, companies, divisions, roles };
  }

  async getOnlyUserById(id: number) {
    const user = await this.entityManager.findOne(User, { where: { id: id } });
    if (!user) {
      return null;
    }

    const { password = null, ...userData }: any = user;

    return userData;
  }

  async findAllUsersByCompanyAndDivision(
    companyId: number,
    divisionId: number,
  ) {
    const users = await this.entityManager
      .createQueryBuilder(User, 'user')
      .innerJoin(
        'user.companies',
        'filterCompany',
        'filterCompany.id = :companyId',
        {
          companyId,
        },
      )
      .innerJoin(
        'user.divisions',
        'filterDivision',
        'filterDivision.id = :divisionId',
        {
          divisionId,
        },
      )
      .leftJoinAndSelect('user.companies', 'companies')
      .leftJoinAndSelect('user.divisions', 'divisions')
      .leftJoinAndSelect('user.userCompanyRoles', 'userCompanyRoles')
      .leftJoinAndSelect('userCompanyRoles.role', 'role')
      .leftJoinAndSelect('userCompanyRoles.company', 'roleCompany')
      .where('user.isActive = :isActive', { isActive: true })
      .distinct(true)
      .getMany();

    return users.map(({ password, hashedRefreshToken, ...user }) => user);
  }

  async disableUser(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companies = { id: activeCompanyId };
    }
    const user = await this.entityManager.findOne(User, { where });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const newIsActiveStatus = !user.isActive;

    await this.entityManager.update(User, id, {
      isActive: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    if (newIsActiveStatus) {
      await this.authorizationService.updateUserCompanyPrivilegesIntoCache(id);
      await this.syncUserCompaniesCache(id);
    } else {
      await this.authorizationService.deleteUserCompanyPrivilegesFromCache(id);
      await this.redisService.deleteUserCompanies(id);
    }

    // Try to find the associated resource to prompt for deactivation
    let associatedResourceId: number | null = null;
    let resourceActive = false;

    if (!newIsActiveStatus) {
      const resourceWhere: any = { email: user.email };
      if (activeCompanyId && activeCompanyId !== 0) {
        resourceWhere.company = { id: activeCompanyId };
      }

      const resource = await this.entityManager.findOne(Resource, {
        where: resourceWhere,
      });

      if (resource && resource.active_status) {
        associatedResourceId = resource.id as number;
        resourceActive = true;
      }
    }

    return {
      message: `User status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
      promptResourceDisable: !newIsActiveStatus && resourceActive,
      associatedResourceId: associatedResourceId,
      email: user.email,
    };
  }

  async checkDeleteUser(id: number, activeCompanyId?: number) {
    const existingUser = await this.entityManager.findOne(User, {
      where: { id },
      relations: ['companies'],
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const effectiveCompanyId = (activeCompanyId && activeCompanyId !== 0) ? activeCompanyId : undefined;

    let hasResource = false;
    let resourceId: number | null = null;
    if (effectiveCompanyId) {
      const resource = await this.entityManager.findOne(Resource, {
        where: {
          email: existingUser.email,
          companyId: effectiveCompanyId,
        },
        select: ['id'],
      });
      if (resource) {
        hasResource = true;
        resourceId = resource.id as number;
      }
    }

    const resourcePoolRepository =
      this.entityManager.getRepository(ResourcePool);
    const resourcePoolWhere: any = { pool_owner: { id } };
    if (effectiveCompanyId) {
      resourcePoolWhere.company = { id: effectiveCompanyId };
    }
    const resourcePoolsCount = await resourcePoolRepository.count({ where: resourcePoolWhere });

    // Build company-scoped task query
    const taskQuery = this.entityManager
      .createQueryBuilder(Task, 'task')
      .leftJoin('task.assignee', 'assignee')
      .leftJoin('task.coAssignees', 'coAssignees')
      .leftJoin('task.members', 'members')
      .where(
        '(assignee.email = :email OR coAssignees.email = :email OR members.email = :email)',
        { email: existingUser.email },
      );

    // Build company-scoped ticket query.
    const ticketQuery = this.entityManager
      .createQueryBuilder(Ticket, 'ticket')
      .leftJoin('ticket.assignee', 'assignee')
      .leftJoin('ticket.participants', 'participants')
      .where('(assignee.userId = :userId OR participants.userId = :userId)', {
        userId: id,
      });

    if (effectiveCompanyId) {
      taskQuery.andWhere('task.companyId = :companyId', {
        companyId: effectiveCompanyId,
      });
      ticketQuery.andWhere('ticket.companyId = :companyId', {
        companyId: effectiveCompanyId,
      });
    }

    const [tasksCount, ticketsCount] = await Promise.all([
      taskQuery.getCount(),
      ticketQuery.getCount(),
    ]);

    return {
      hasResource,
      resourceId,
      resourcePoolsCount,
      tasksCount,
      ticketsCount,
    };
  }

  async deleteUser(
    id: number,
    authUser: any,
    activeCompanyId?: number,
    deleteLinkedResources = false,
    deleteResource = false,
  ) {
    if (!activeCompanyId || activeCompanyId === 0) {
      throw new BadRequestException('Active company ID is required to delete a user');
    }

    const existingUser = await this.entityManager.findOne(User, {
      where: { id, companies: { id: activeCompanyId } },
      relations: ['companies'],
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found in this company`);
    }

    const resourcePoolRepository =
      this.entityManager.getRepository(ResourcePool);

    const resourcePoolWhere: any = { pool_owner: { id }, company: { id: activeCompanyId } };

    // Build company-scoped task query
    const taskQuery = this.entityManager
      .createQueryBuilder(Task, 'task')
      .leftJoin('task.assignee', 'assignee')
      .leftJoin('task.coAssignees', 'coAssignees')
      .leftJoin('task.members', 'members')
      .where(
        '(assignee.email = :email OR coAssignees.email = :email OR members.email = :email)',
        { email: existingUser.email },
      )
      .andWhere('task.companyId = :companyId', {
        companyId: activeCompanyId,
      });

    // Build company-scoped ticket query.
    const ticketQuery = this.entityManager
      .createQueryBuilder(Ticket, 'ticket')
      .leftJoin('ticket.assignee', 'assignee')
      .leftJoin('ticket.participants', 'participants')
      .where('(assignee.userId = :userId OR participants.userId = :userId)', {
        userId: id,
      })
      .andWhere('ticket.companyId = :companyId', {
        companyId: activeCompanyId,
      });

    const [resourcePoolsCount, tasksCount, ticketsCount] = await Promise.all([
      resourcePoolRepository.count({ where: resourcePoolWhere }),
      taskQuery.getCount(),
      ticketQuery.getCount(),
    ]);

    // --- 1. RESOURCE POOL OWNERSHIP — always a hard block ---
    if (resourcePoolsCount > 0) {
      return {
        error: 'Cannot delete user: resource pool ownership must be reassigned first',
        message: `User owns ${resourcePoolsCount} resource pool(s) in this company. Please reassign ownership before deleting`,
        resourcePoolsCount,
        status: 400,
      };
    }

    // --- 2. TASKS / TICKETS — ask for confirmation unless caller already confirmed ---
    if ((tasksCount > 0 || ticketsCount > 0) && !deleteLinkedResources && !deleteResource) {
      return {
        requiresConfirmation: true,
        tasksCount,
        ticketsCount,
        message:
          `User is linked to ${tasksCount} task(s) and ${ticketsCount} ticket(s) in this company` +
          `Send the request again with deleteLinkedResources=true to unassign and proceed.`,
      };
    }

    // --- 3. NULLIFY LINKED RECORDS (only when deleteLinkedResources=true or deleteResource=true) ---
    if ((deleteLinkedResources || deleteResource) && (tasksCount > 0 || ticketsCount > 0)) {
      await this.entityManager.transaction(async (tem) => {
        // Find the resource record for this user in the current company
        const resourceWhere: any = { email: existingUser.email, companyId: activeCompanyId };
        const userResource = await tem.findOne(Resource, {
          where: resourceWhere,
          select: ['id'],
        });

        if (userResource) {
          const resourceId = userResource.id as number;

          // 3a. Nullify task assignee where this resource is the assignee
          const assigneeTasksQb = tem
            .createQueryBuilder(Task, 'task')
            .innerJoin('task.assignee', 'assignee', 'assignee.id = :resourceId', { resourceId })
            .andWhere('task.companyId = :companyId', { companyId: activeCompanyId })
            .select('task.id', 'id');
          const assigneeTasks = await assigneeTasksQb.getRawMany();
          if (assigneeTasks.length > 0) {
            const taskIds = assigneeTasks.map((t) => t.id);
            await tem
              .createQueryBuilder()
              .update(Task)
              .set({
                assigneeId: null as any,
                assigneeName: null as any,
                assigneeEmail: null as any,
                assigneeProfilePicUrl: null as any,
                assigneeSkill: null as any,
              })
              .where('id IN (:...taskIds)', { taskIds })
              .execute();
          }

          // 3b. Remove from co-assignees join table (tm_task_co_assignees)
          const coAssigneeTasks = await tem
            .createQueryBuilder(Task, 'task')
            .innerJoin(
              'task.coAssignees',
              'coAssignee',
              'coAssignee.id = :resourceId',
              { resourceId },
            )
            .andWhere('task.companyId = :companyId', { companyId: activeCompanyId })
            .select('task.id')
            .getMany();
          for (const task of coAssigneeTasks) {
            await tem
              .createQueryBuilder()
              .relation(Task, 'coAssignees')
              .of(task.id)
              .remove(resourceId);
          }

          // 3c. Remove from members join table (tm_task_members)
          const memberTasks = await tem
            .createQueryBuilder(Task, 'task')
            .innerJoin(
              'task.members',
              'member',
              'member.id = :resourceId',
              { resourceId },
            )
            .andWhere('task.companyId = :companyId', { companyId: activeCompanyId })
            .select('task.id')
            .getMany();
          for (const task of memberTasks) {
            await tem
              .createQueryBuilder()
              .relation(Task, 'members')
              .of(task.id)
              .remove(resourceId);
          }
        }

        // 3d. Find the TicketSpaceMember records for this user (company-scoped via ticket space)
        //     then nullify ticket assignee and remove from participants join table.
        const spaceMemberships = await tem.find(TicketSpaceMember, {
          where: { userId: id },
          select: ['id'],
        });
        const memberIds = spaceMemberships.map((m) => m.id as number);

        if (memberIds.length > 0) {
          // Nullify assigneeId on tickets where this member is the assignee (company-scoped)
          const assigneeTicketQb = tem
            .createQueryBuilder(Ticket, 'ticket')
            .innerJoin(
              'ticket.assignee',
              'assignee',
              'assignee.userId = :userId',
              { userId: id },
            )
            .andWhere('ticket.companyId = :companyId', {
              companyId: activeCompanyId,
            })
            .select('ticket.id');
          const assigneeTickets = await assigneeTicketQb.getMany();
          if (assigneeTickets.length > 0) {
            const ticketIds = assigneeTickets.map((t) => t.id);
            await tem
              .createQueryBuilder()
              .update(Ticket)
              .set({
                assigneeId: null as any,
                assigneeName: null as any,
                assigneeEmail: null as any,
                assigneeProfilePicUrl: null as any,
              })
              .where('id IN (:...ticketIds)', { ticketIds })
              .execute();
          }

          // Remove from participants join table (ticket_participants)
          const participantTicketQb = tem
            .createQueryBuilder(Ticket, 'ticket')
            .innerJoin(
              'ticket.participants',
              'participant',
              'participant.userId = :userId',
              { userId: id },
            )
            .andWhere('ticket.companyId = :companyId', {
              companyId: activeCompanyId,
            })
            .select('ticket.id');
          const participantTickets = await participantTicketQb.getMany();
          for (const ticket of participantTickets) {
            // Remove all memberIds belonging to this user from each ticket's participants
            await tem
              .createQueryBuilder()
              .relation(Ticket, 'participants')
              .of(ticket.id)
              .remove(memberIds);
          }
        }
      });
    }

    // --- 4. DELETE ASSOCIATED RESOURCE (only when deleteResource=true) ---
    if (deleteResource) {
      const resource = await this.entityManager.findOne(Resource, {
        where: {
          email: existingUser.email,
          companyId: activeCompanyId,
        },
        select: ['id'],
      });
      if (resource) {
        const resourceId = resource.id;
        await this.entityManager.transaction(async (tem) => {
          // Cleanup ResourceSkill
          await tem.delete(ResourceSkill, { resourceId });

          // Cleanup ResourcePool association
          await tem
            .createQueryBuilder()
            .delete()
            .from('resource_pool_resources_resource')
            .where('resourceId = :resourceId', { resourceId })
            .execute();

          // Cleanup reportingPersonId references
          await tem.update(Resource, { reportingPersonId: resourceId }, { reportingPersonId: null });

          // Cleanup PulseWeek references
          await tem.getRepository(PulseWeek).update({ submittedToId: resourceId }, { submittedToId: null as any });
          await tem.getRepository(PulseWeek).update({ approvedById: resourceId }, { approvedById: null as any });

          // Now delete Resource
          await tem.delete(Resource, resourceId);
        });
      }
    }

    // --- 5. REMOVE RELATION AND ROLES FOR THE COMPANY ---
    // 1. Remove UserCompanyRole for this company
    await this.entityManager.delete(UserCompanyRole, {
      userId: id,
      companyId: activeCompanyId,
    });

    // 2. Remove company from user.companies using relation builder to avoid clearing others
    await this.entityManager
      .createQueryBuilder()
      .relation(User, 'companies')
      .of(id)
      .remove(activeCompanyId);

    // Reset defaultCompanyId if it was the one being removed
    if (existingUser.defaultCompanyId === activeCompanyId) {
      const remainingCompanies = existingUser.companies.filter(
        (c) => c.id !== activeCompanyId,
      );
      const newDefaultId =
        remainingCompanies.length > 0 ? remainingCompanies[0].id : null;

      await this.entityManager.update(User, id, {
        defaultCompanyId: newDefaultId as any,
      });
    }

    // 3. Update cache
    await this.authorizationService.updateUserCompanyPrivilegesIntoCache(id);
    await this.syncUserCompaniesCache(id);
  }

  async PasswordReset(
    id: number,
    authUser: any,
    data: any,
    activeCompanyId?: number,
  ) {
    const { oldPassword, newPassword } = data;

    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companies = { id: activeCompanyId };
    }

    const user = await this.entityManager.findOne(User, {
      where,
      select: ['id', 'password', 'email'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (authUser.userId !== user.id) {
      throw new NotFoundException(
        "You are not authorized to change this user's password",
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new NotFoundException("Your current password isn't correct");
    }

    // 4. Hash New Password and Save
    const salt = await bcrypt.genSalt();
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedNewPassword;

    await this.entityManager.save(User, user);

    return { message: 'Password updated' };
  }

  async getUserCompanyRolesByUserIds(
    userIds: number[],
    companyId?: number,
  ): Promise<Record<number, UserCompanyRole[]>> {
    if (!userIds.length) return {};
    const where: any = { userId: In(userIds) };
    if (companyId && companyId !== 0) {
      where.companyId = companyId;
    }
    const records = await this.entityManager.find(UserCompanyRole, {
      where,
      relations: ['role', 'company'],
    });
    const map: Record<number, UserCompanyRole[]> = {};
    for (const r of records) {
      if (!map[r.userId]) map[r.userId] = [];
      map[r.userId].push(r);
    }
    return map;
  }

  async setDefaultCompany(userId: number, companyId: number) {
    const user = await this.entityManager.findOne(User, {
      where: { id: userId },
      relations: ['companies'],
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const hasCompany = user.companies?.some((c) => c.id === companyId);
    if (!hasCompany) {
      throw new Error('User does not belong to this company');
    }

    user.defaultCompanyId = companyId;
    await this.entityManager.save(User, user);

    return {
      message: 'Default company updated',
      defaultCompanyId: companyId,
    };
  }

  // ─── Password Reset ────────────────────────────────────────────────────── //

  async setPasswordResetToken(
    userId: number,
    hashedToken: string,
    expiry: Date,
  ): Promise<void> {
    await this.entityManager.update(User, userId, {
      passwordResetToken: hashedToken,
      passwordResetTokenExpiry: expiry,
    });
  }

  async findByResetToken(hashedToken: string): Promise<User | null> {
    return this.entityManager
      .createQueryBuilder(User, 'user')
      .where('user.passwordResetToken = :token', { token: hashedToken })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .addSelect('user.passwordResetToken')
      .addSelect('user.passwordResetTokenExpiry')
      .getOne();
  }

  async resetPasswordByToken(
    userId: number,
    newPassword: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.entityManager.update(User, userId, {
      password: hashed,
      passwordResetToken: null as unknown as string,
      passwordResetTokenExpiry: null as unknown as Date,
    });
  }

  /** Returns all active users in a company — used for internal meeting attendee selection. */
  async getUsersByCompany(companyId: number): Promise<any[]> {
    const users = await this.entityManager
      .createQueryBuilder(User, 'user')
      .innerJoin('user.companies', 'company', 'company.id = :companyId', { companyId })
      .where('user.isActive = :isActive', { isActive: true })
      .select(['user.id', 'user.first_name', 'user.last_name', 'user.email', 'user.profile_picture'])
      .orderBy('user.first_name', 'ASC')
      .getMany();
    return users;
  }
}
