import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from './user.entity';
import { UserRegistrationSource } from '../../common/enum/user-registration-source.enum';
import { UserCompanyRole } from './user-company-role.entity';
import { EntityManager, In, QueryFailedError } from 'typeorm';
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
import { normalizeEmail } from '../../common/email-builder';
import { Resource } from '../../resource-management/resource/resource.entity';
import { Calendar } from '../../resource-management/calendar/calendar.entity';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Task } from '../../task-management/task/task.entity';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { TicketSpaceMember } from '../../ticket-management/ticket-space-member/ticket-space-member.entity';
import { ResourceSkill } from '../../resource-management/resource/resource-skill.entity';
import { Pulse } from '../../pulse/pulse.entity';
import { PulseWeek } from '../../pulse/pulse-week.entity';
import { OtpVerification } from '../../auth/otp-verification.entity';
import { TaskSpace } from 'src/task-management/task-space/task-space.entity';
import {
  USER_PROFILE_UPDATED_EVENT,
  UserProfileUpdatedEventPayload,
} from '../../comment/comment/comment.service';

@Injectable()
export class UserService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

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
    const rawDto = createUserDto as unknown as Record<string, unknown>;
    const isProfilePicRemoved =
      rawDto.profile_picture === null ||
      rawDto.profile_picture === 'null' ||
      rawDto.remove_profile_picture === 'true' ||
      rawDto.remove_profile_picture === true;

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
        } else if (isProfilePicRemoved) {
          savedUser.profile_picture = null as unknown as string;
          savedUser = await transactionalEntityManager.save(savedUser);
        }

        // Handle Companies
        let newCompanyIds = createUserDto.companyIds;

        // Security: If not system admin, force the user to be created in the active company
        if (activeCompanyId && activeCompanyId !== 0) {
          newCompanyIds = [activeCompanyId];
        }

        if (Array.isArray(newCompanyIds)) {
          const existingCompanyIds =
            savedUser.companies?.map((c) => c.id) || [];

          if (isExistingUser) {
            const isAlreadyInCompany = newCompanyIds.some((id) =>
              existingCompanyIds.includes(id),
            );
            if (isAlreadyInCompany) {
              throw new BadRequestException(
                'This user is already a member of this company.',
              );
            }
          }

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
          if (activeCompanyId && activeCompanyId !== 0) {
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
              const resource = new Resource();
              resource.first_name = savedUser.first_name;
              resource.last_name = savedUser.last_name;
              resource.email = savedUser.email;
              if (savedUser.id) {
                resource.userId = savedUser.id;
              }
              if (savedUser.mobile_number) {
                resource.mobile = savedUser.mobile_number;
              }
              resource.working_hours = 8;
              resource.companyId = targetCompanyId;
              if (createUserDto.divisionIds?.[0]) {
                resource.divisionId = createUserDto.divisionIds[0];
              }
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

    const profilePicChanged = Boolean(file) || isProfilePicRemoved;
    const nextProfilePicUrl: string | null | undefined = file
      ? savedUserResult.profile_picture
      : isProfilePicRemoved
        ? null
        : undefined;

    if (profilePicChanged) {
      setImmediate(() => {
        void this.propagateUserProfileUpdate(savedUserResult.email, {
          profilePicUrl: nextProfilePicUrl,
          firstName: savedUserResult.first_name,
          lastName: savedUserResult.last_name,
        }).catch((err) =>
          console.error(
            '[UserService] Background propagateUserProfileUpdate on create failed:',
            err,
          ),
        );
      });
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
      throw new NotFoundException('User not found');
    }

    const isProfilePicRemoved =
      userData.profile_picture === null ||
      userData.profile_picture === 'null' ||
      userData.remove_profile_picture === 'true' ||
      userData.remove_profile_picture === true;

    // Update basic fields when provided (supports both standalone profile-picture removal and full updates)
    if (userData.first_name !== undefined) {
      existingUser.first_name = userData.first_name;
    }
    if (userData.last_name !== undefined) {
      existingUser.last_name = userData.last_name;
    }
    if (userData.email) {
      const normalizedEmail = normalizeEmail(userData.email);
      // Email is immutable after creation — reject any attempt to change it.
      if (normalizedEmail !== existingUser.email) {
        throw new BadRequestException('Email cannot be changed after creation.');
      }
    }
    if (userData.isActive !== undefined) {
      existingUser.isActive = userData.isActive;
    }
    if (userData.phone_number !== undefined) {
      existingUser.mobile_number = userData.phone_number;
    } else if (userData.mobile_number !== undefined) {
      existingUser.mobile_number = userData.mobile_number;
    }

    if (file) {
      const imageUrl = await uploadToAzure(file, existingUser.id as number);
      existingUser.profile_picture = imageUrl;
    } else if (isProfilePicRemoved) {
      existingUser.profile_picture = null as unknown as string;
    }

    existingUser.updatedBy = authUser.email;

    // Only update password if provided
    if (userData.password && userData.password.trim() !== '') {
      const saltRounds = 10;
      existingUser.password = await bcrypt.hash(userData.password, saltRounds);
    }

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

    // 1. Primary DB update: save the updated user and load the response payload FIRST
    const savedUser = await this.entityManager.save(User, existingUser);

    const updatedUserResponse = await this.entityManager.findOne(User, {
      where: { id: savedUser.id },
      relations: [
        'companies',
        'divisions',
        'userCompanyRoles',
        'userCompanyRoles.role',
        'userCompanyRoles.company',
      ],
    });

    const profilePicChanged = Boolean(file) || isProfilePicRemoved;
    const nextProfilePicUrl: string | null | undefined = file
      ? existingUser.profile_picture
      : isProfilePicRemoved
        ? null
        : undefined;

    // 2. Decoupled background execution: schedule Redis cache updates and heavy
    // cross-entity synchronization via `setImmediate` so the HTTP response is
    // returned to the client FIRST before background sync jobs run.
    setImmediate(() => {
      void this.authorizationService
        .updateUserCompanyPrivilegesIntoCache(savedUser.id as number)
        .catch((err) =>
          console.error(
            '[UserService] Failed to update user privileges cache:',
            err,
          ),
        );
      void this.syncUserCompaniesCache(savedUser.id as number).catch((err) =>
        console.error(
          '[UserService] Failed to sync user companies cache:',
          err,
        ),
      );
      void this.propagateUserProfileUpdate(existingUser.email, {
        ...(profilePicChanged ? { profilePicUrl: nextProfilePicUrl } : {}),
        firstName: existingUser.first_name,
        lastName: existingUser.last_name,
      }).catch((err) =>
        console.error('[UserService] propagateUserProfileUpdate failed:', err),
      );
      this.eventEmitter.emit(USER_PROFILE_UPDATED_EVENT, {
        userId: savedUser.id as number,
        firstName: existingUser.first_name,
        lastName: existingUser.last_name,
        ...(profilePicChanged ? { profilePicture: nextProfilePicUrl } : {}),
      } satisfies UserProfileUpdatedEventPayload);
    });

    // Return the user with all relations loaded immediately
    return updatedUserResponse;
  }

  /**
   * After a user is updated, asynchronously sync changed fields to:
   *   1. All Resource rows with the same email  (profile_pic, first_name, last_name)
   *   2. Every Task where those resources are the assignee  (assigneeProfilePicUrl, assigneeName)
   *   3. Every Ticket where those resources are the assignee  (assigneeProfilePicUrl, assigneeName)
   *   4. Every TicketSpaceMember with the same email  (userProfilePicture)
   *
   * Each field is optional — only supplied fields (including `null` for removal) are written.
   * Runs strictly in the background after the HTTP response has been sent.
   */
  private async propagateUserProfileUpdate(
    email: string,
    opts: {
      profilePicUrl?: string | null;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<void> {
    const { profilePicUrl, firstName, lastName } = opts;

    // Build partial update payloads — only include fields that actually changed
    const resourcePatch: Partial<{
      profile_pic: string;
      first_name: string;
      last_name: string;
    }> = {};
    const assigneePatch: Partial<{
      assigneeProfilePicUrl: string;
      assigneeName: string;
    }> = {};
    const memberPatch: Partial<{ userProfilePicture: string }> = {};

    if (profilePicUrl !== undefined) {
      resourcePatch.profile_pic = profilePicUrl as unknown as string;
      assigneePatch.assigneeProfilePicUrl = profilePicUrl as unknown as string;
      memberPatch.userProfilePicture = profilePicUrl as unknown as string;
    }
    if (firstName !== undefined) resourcePatch.first_name = firstName;
    if (lastName !== undefined) resourcePatch.last_name = lastName;
    if (firstName !== undefined || lastName !== undefined) {
      assigneePatch.assigneeName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
    }

    // Find matching resource IDs (a user can be a resource in multiple companies)
    const resources = await this.entityManager.find(Resource, {
      where: { email },
      select: ['id'],
    });
    const resourceIds = resources.map((r) => r.id as number).filter(Boolean);

    const jobs: Promise<unknown>[] = [];

    if (Object.keys(resourcePatch).length > 0 && email) {
      jobs.push(
        this.entityManager
          .update(Resource, { email }, resourcePatch)
          .catch((err) =>
            console.error(
              '[propagateUserProfileUpdate] Resource update failed:',
              err,
            ),
          ),
      );
    }

    if (Object.keys(assigneePatch).length > 0) {
      if (resourceIds.length > 0) {
        jobs.push(
          this.entityManager
            .createQueryBuilder()
            .update(Task)
            .set(assigneePatch)
            .where('assigneeId IN (:...ids)', { ids: resourceIds })
            .execute()
            .catch((err) =>
              console.error(
                '[propagateUserProfileUpdate] Task update failed:',
                err,
              ),
            ),

          this.entityManager
            .createQueryBuilder()
            .update(Ticket)
            .set(assigneePatch)
            .where('assigneeId IN (:...ids)', { ids: resourceIds })
            .execute()
            .catch((err) =>
              console.error(
                '[propagateUserProfileUpdate] Ticket (by assigneeId) update failed:',
                err,
              ),
            ),
        );
      }

      if (email) {
        jobs.push(
          this.entityManager
            .update(Ticket, { assigneeEmail: email }, assigneePatch)
            .catch((err) =>
              console.error(
                '[propagateUserProfileUpdate] Ticket (by assigneeEmail) update failed:',
                err,
              ),
            ),
        );
      }
    }

    if (Object.keys(memberPatch).length > 0 && email) {
      jobs.push(
        this.entityManager
          .update(TicketSpaceMember, { userEmail: email }, memberPatch)
          .catch((err) =>
            console.error(
              '[propagateUserProfileUpdate] TicketSpaceMember update failed:',
              err,
            ),
          ),
      );
    }

    await Promise.all(jobs);
  }

  async updateRefreshToken(userId: number, refreshToken: string | undefined) {
    const hashedRefreshToken = refreshToken
      ? await bcrypt.hash(refreshToken, 10)
      : null;
    await this.entityManager.update(User, { id: userId }, {
      hashedRefreshToken: hashedRefreshToken as unknown as string,
    });
    return hashedRefreshToken;
  }

  async searchByEmail(email: string) {
    return await this.entityManager.findOne(User, {
      where: { email: normalizeEmail(email) },
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
        'divisions',
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
    const qb = this.entityManager
      .createQueryBuilder(User, 'user')
      .where('user.id = :id', { id })
      .leftJoinAndSelect('user.companies', 'companies')
      .leftJoinAndSelect('user.divisions', 'divisions')
      .leftJoinAndSelect('user.userCompanyRoles', 'userCompanyRoles')
      .leftJoinAndSelect('userCompanyRoles.company', 'company')
      .leftJoinAndSelect('userCompanyRoles.role', 'role')
      .leftJoinAndSelect('role.privileges', 'privileges');

    if (companyId && companyId !== 0) {
      qb.innerJoin(
        'user.companies',
        'filterCompany',
        'filterCompany.id = :companyId',
        { companyId },
      );
    }

    const user = await qb.getOne();

    if (!user) {
      return null;
    }

    const { password = null, ...userData }: any = user;

    let userCompanyRoles = user.userCompanyRoles || [];

    // Filter the roles array to only include the active company
    if (companyId && companyId !== 0) {
      userCompanyRoles = userCompanyRoles.filter(
        (ucr) => ucr.company?.id === companyId || (ucr as any).companyId === companyId,
      );
    }

    const divisions = user.divisions;

    const roles = userCompanyRoles.map((ucr) => ucr.role);
    const companies = userCompanyRoles.map((ucr) => ucr.company);

    return { ...userData, companies, divisions, roles, userCompanyRoles };
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

    // Build company-scoped task space query
    const taskSpaceQuery = this.entityManager
      .createQueryBuilder(TaskSpace, 'taskSpace')
      .leftJoin('taskSpace.owners', 'owner')
      .leftJoin('taskSpace.resources', 'resource')
      .where('(owner.id = :userId OR resource.email = :email)', {
        userId: id,
        email: existingUser.email,
      });

    // Build company-scoped ticket space member query
    const ticketSpaceQuery = this.entityManager
      .createQueryBuilder(TicketSpaceMember, 'tsm')
      .innerJoin('tsm.ticketSpace', 'space')
      .where('tsm.userId = :userId', { userId: id });

    if (effectiveCompanyId) {
      taskQuery.andWhere('task.companyId = :companyId', {
        companyId: effectiveCompanyId,
      });
      ticketQuery.andWhere('ticket.companyId = :companyId', {
        companyId: effectiveCompanyId,
      });
      taskSpaceQuery.andWhere('taskSpace.companyId = :companyId', {
        companyId: effectiveCompanyId,
      });
      ticketSpaceQuery.andWhere('space.companyId = :companyId', {
        companyId: effectiveCompanyId,
      });
    }

    const [tasksCount, ticketsCount, taskSpacesCount, ticketSpacesCount] = await Promise.all([
      taskQuery.getCount(),
      ticketQuery.getCount(),
      taskSpaceQuery.getCount(),
      ticketSpaceQuery.getCount(),
    ]);

    return {
      hasResource,
      resourceId,
      resourcePoolsCount,
      tasksCount,
      ticketsCount,
      taskSpacesCount,
      ticketSpacesCount,
    };
  }

  async deleteUser(
    id: number,
    _authUser: { userId: number; email?: string } | Record<string, unknown>,
    activeCompanyId?: number,
    _deleteLinkedResources = false,
    _deleteResource = false,
  ) {
    if (!activeCompanyId || activeCompanyId === 0) {
      throw new BadRequestException('Active company ID is required to delete a user');
    }

    let isCompletelyDeleted = false;
    let targetUserName = `User #${id}`;

    try {
      // 1. Single Atomic Transaction: wrap entire validation, deletion, and cleanup
      await this.entityManager.transaction(async (tem) => {
        // Fetch the user with ALL their associated companies (do not filter the relation in WHERE)
        const existingUser = await tem.findOne(User, {
          where: { id },
          relations: ['companies'],
        });

        if (!existingUser) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }

        const isMemberOfActiveCompany = (existingUser.companies ?? []).some(
          (company) => Number(company.id) === Number(activeCompanyId),
        );

        if (!isMemberOfActiveCompany) {
          throw new NotFoundException(
            `User with ID ${id} not found in this company`,
          );
        }

        targetUserName =
          `${existingUser.first_name || ''} ${existingUser.last_name || ''}`.trim() ||
          existingUser.email;

        // 2. Strict Hard Blocks: Count linked active records in the active company
        // (a) Resource Pools (as owner)
        const resourcePoolsCount = await tem
          .getRepository(ResourcePool)
          .createQueryBuilder('rp')
          .innerJoin('rp.pool_owner', 'poolOwner', 'poolOwner.id = :userId', { userId: id })
          .innerJoin('rp.company', 'company', 'company.id = :companyId', { companyId: activeCompanyId })
          .getCount();

        // (b) Tasks (as assignee, co-assignee, or member)
        const tasksCount = await tem
          .createQueryBuilder(Task, 'task')
          .leftJoin('task.assignee', 'assignee')
          .leftJoin('task.coAssignees', 'coAssignees')
          .leftJoin('task.members', 'members')
          .where('task.companyId = :companyId', { companyId: activeCompanyId })
          .andWhere(
            '(assignee.email = :email OR task.assigneeEmail = :email OR coAssignees.email = :email OR members.email = :email)',
            { email: existingUser.email },
          )
          .getCount();

        // (c) Tickets (as assignee or participant)
        const ticketsCount = await tem
          .createQueryBuilder(Ticket, 'ticket')
          .leftJoin('ticket.assignee', 'assignee')
          .leftJoin('ticket.participants', 'participants')
          .where('ticket.companyId = :companyId', { companyId: activeCompanyId })
          .andWhere('(assignee.userId = :userId OR participants.userId = :userId)', {
            userId: id,
          })
          .getCount();

        // (d) Task Spaces (as owner or member)
        const taskSpacesCount = await tem
          .createQueryBuilder(TaskSpace, 'taskSpace')
          .leftJoin('taskSpace.owners', 'owner')
          .leftJoin('taskSpace.resources', 'resource')
          .where('taskSpace.companyId = :companyId', { companyId: activeCompanyId })
          .andWhere('(owner.id = :userId OR resource.email = :email)', {
            userId: id,
            email: existingUser.email,
          })
          .getCount();

        // (e) Ticket Spaces (as member)
        const ticketSpacesCount = await tem
          .createQueryBuilder(TicketSpaceMember, 'tsm')
          .innerJoin('tsm.ticketSpace', 'space')
          .where('tsm.userId = :userId', { userId: id })
          .andWhere('space.companyId = :companyId', { companyId: activeCompanyId })
          .getCount();

        // Hard block validation: If user is linked to ANY of these, immediately stop and throw ConflictException
        if (
          resourcePoolsCount > 0 ||
          tasksCount > 0 ||
          ticketsCount > 0 ||
          taskSpacesCount > 0 ||
          ticketSpacesCount > 0
        ) {
          const reasons: string[] = [];
          if (resourcePoolsCount > 0) {
            reasons.push(`${resourcePoolsCount} resource pool(s) as owner`);
          }
          if (tasksCount > 0) {
            reasons.push(`${tasksCount} task(s) as assignee, co-assignee, or member`);
          }
          if (ticketsCount > 0) {
            reasons.push(`${ticketsCount} ticket(s) as assignee or participant`);
          }
          if (taskSpacesCount > 0) {
            reasons.push(`${taskSpacesCount} task space(s) as owner or member`);
          }
          if (ticketSpacesCount > 0) {
            reasons.push(`${ticketSpacesCount} ticket space(s) as member`);
          }

          throw new ConflictException({
            status: 409,
            error: 'Cannot delete user due to active relationships',
            message: `Cannot remove "${targetUserName}" because they are currently linked to ${reasons.join(', ')}. Please reassign or remove them from these records first.`,
            counts: {
              resourcePoolsCount,
              tasksCount,
              ticketsCount,
              taskSpacesCount,
              ticketSpacesCount,
            },
          });
        }

        // 3. Auto-Delete Pulse & PulseWeek records belonging to this user in the active company
        const userPulseWeeks = await tem.find(PulseWeek, {
          where: { userId: id, companyId: activeCompanyId },
          select: ['id'],
        });

        if (userPulseWeeks.length > 0) {
          const pulseWeekIds = userPulseWeeks.map((pw) => pw.id);
          await tem
            .createQueryBuilder()
            .delete()
            .from(Pulse)
            .where('pulseWeekId IN (:...pulseWeekIds)', { pulseWeekIds })
            .execute();

          await tem.delete(PulseWeek, {
            userId: id,
            companyId: activeCompanyId,
          });
        }

        // 4. Fix UserCompanyRole Deletion: proper relation targeting inside the transaction
        await tem.delete(UserCompanyRole, {
          user: { id },
          company: { id: activeCompanyId },
        });

        // 5. Final Cleanup
        // (a) Delete associated Resource profile and clear dangling references
        const userResource = await tem.findOne(Resource, {
          where: { email: existingUser.email, companyId: activeCompanyId },
          select: ['id'],
        });

        if (userResource) {
          const resourceId = userResource.id as number;

          // Cleanup ResourceSkill
          await tem.delete(ResourceSkill, { resourceId });

          // Cleanup ResourcePool membership join table
          await tem
            .createQueryBuilder()
            .delete()
            .from('resource_pool_resources_resource')
            .where('resourceId = :resourceId', { resourceId })
            .execute();

          // Cleanup TaskSpace resources join table
          await tem
            .createQueryBuilder()
            .delete()
            .from('task_space_resources')
            .where('resourceId = :resourceId', { resourceId })
            .execute();

          // Clear reportingPersonId references on other resources
          await tem
            .createQueryBuilder()
            .update(Resource)
            .set({ reportingPersonId: () => 'NULL' })
            .where('reportingPersonId = :resourceId', { resourceId })
            .execute();

          // Clear PulseWeek references submittedToId and approvedById on other pulse weeks
          await tem
            .createQueryBuilder()
            .update(PulseWeek)
            .set({ submittedToId: () => 'NULL' })
            .where('submittedToId = :resourceId', { resourceId })
            .execute();
          await tem
            .createQueryBuilder()
            .update(PulseWeek)
            .set({ approvedById: () => 'NULL' })
            .where('approvedById = :resourceId', { resourceId })
            .execute();

          // Delete Resource record
          await tem.delete(Resource, resourceId);
        }

        // (b) Remove user from company's divisions
        const userDivisions = await tem
          .createQueryBuilder(Division, 'division')
          .innerJoin('division.users', 'user', 'user.id = :userId', { userId: id })
          .where('division.companyId = :companyId', { companyId: activeCompanyId })
          .select(['division.id'])
          .getMany();

        if (userDivisions.length > 0) {
          await tem
            .createQueryBuilder()
            .relation(User, 'divisions')
            .of(id)
            .remove(userDivisions.map((d) => d.id));
        }

        // (c) Remove company from user.companies relation
        await tem
          .createQueryBuilder()
          .relation(User, 'companies')
          .of(id)
          .remove(activeCompanyId);

        // (d) Check remaining companies & handle user deletion / default company reset
        const remainingCompanies = (existingUser.companies ?? []).filter(
          (c) => Number(c.id) !== Number(activeCompanyId),
        );

        isCompletelyDeleted = remainingCompanies.length === 0;

        if (isCompletelyDeleted) {
          // Clean up any remaining non-cascading foreign key references before deleting the User record
          const remainingPulseWeeks = await tem.find(PulseWeek, {
            where: { userId: id },
            select: ['id'],
          });
          if (remainingPulseWeeks.length > 0) {
            const remainingPwIds = remainingPulseWeeks.map((pw) => pw.id);
            await tem
              .createQueryBuilder()
              .delete()
              .from(Pulse)
              .where('pulseWeekId IN (:...remainingPwIds)', { remainingPwIds })
              .execute();
            await tem.delete(PulseWeek, { userId: id });
          }

          await tem
            .createQueryBuilder()
            .delete()
            .from('note_shared_users')
            .where('userId = :userId', { userId: id })
            .execute();

          await tem
            .createQueryBuilder()
            .delete()
            .from('filter_template_shared_users')
            .where('userId = :userId', { userId: id })
            .execute();

          await tem.query('UPDATE "email" SET "userId" = NULL WHERE "userId" = $1', [id]);
          await tem.query(
            'UPDATE "notification" SET "userId" = NULL WHERE "userId" = $1',
            [id],
          );

          // User belonged ONLY to this company -> completely delete User record
          await tem.delete(User, id);
        } else {
          // User belongs to other companies -> update defaultCompanyId if needed
          if (Number(existingUser.defaultCompanyId) === Number(activeCompanyId)) {
            const newDefaultId = remainingCompanies[0].id;
            await tem.update(User, id, {
              defaultCompanyId: newDefaultId,
            });
          }
        }
      });
    } catch (error: unknown) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as
          | { code?: string; table?: string }
          | undefined;
        if (driverError?.code === '23503') {
          throw new ConflictException(
            `Cannot delete "${targetUserName}" because they are still referenced by active records${driverError.table ? ` in "${driverError.table}"` : ''}. Please reassign or remove those records first.`,
          );
        }
      }
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : `Failed to delete user "${targetUserName}".`,
      );
    }

    // 6. Post-Transaction Cache Invalidation / Synchronization
    if (isCompletelyDeleted) {
      await this.authorizationService.deleteUserCompanyPrivilegesFromCache(id);
      await this.redisService.deleteUserCompanies(id);
    } else {
      await this.authorizationService.updateUserCompanyPrivilegesIntoCache(id);
      await this.syncUserCompaniesCache(id);
    }

    return {
      success: true,
      message: isCompletelyDeleted
        ? `User "${targetUserName}" was permanently deleted as they had no other active company memberships.`
        : `User "${targetUserName}" was successfully removed from this company.`,
    };
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

  // ─── Self-Registration ─────────────────────────────────────────────────── //

  async isEmailTaken(email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    const [inUser, inTemp] = await Promise.all([
      this.entityManager.findOne(User, { where: { email: normalized } }),
      this.entityManager.findOne(OtpVerification, { where: { email: normalized } }),
    ]);
    return !!(inUser || inTemp);
  }

  /**
   * Saves registration data to `user_temporary`.
   * The caller is responsible for sending the verification email.
   * Throws 'EMAIL_ALREADY_EXISTS' if the email is already in `user`.
   * Throws 'PENDING_REGISTRATION_EXISTS' if a pending (unverified) row already exists.
   */
  async createPendingRegistration(
    email: string,
    hashedVerificationCode: string,
    expiry: Date,
  ): Promise<OtpVerification> {
    const normalizedEmail = normalizeEmail(email);

    // Guard: reject if email already verified and in the main user table
    const existingUser = await this.entityManager.findOne(User, {
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // Guard: if a pending row already exists, remove it so a fresh token is issued
    await this.entityManager.delete(OtpVerification, { email: normalizedEmail });

    const pending = new OtpVerification();
    pending.email = normalizedEmail;
    pending.hashed_otp = hashedVerificationCode;
    pending.expiry = expiry;
    pending.attempts = 0;

    return this.entityManager.save(OtpVerification, pending);
  }

  async findPendingByEmail(email: string): Promise<OtpVerification | null> {
    return this.entityManager.findOne(OtpVerification, {
      where: { email: normalizeEmail(email) },
    });
  }

  /**
   * Atomically consumes one verification attempt.
   * Returns the new attempt count, or `null` if the limit was already reached.
   * Done as a single conditional UPDATE so concurrent guesses can't bypass the cap.
   */
  async consumeVerificationAttempt(
    pendingId: number,
    maxAttempts: number,
  ): Promise<number | null> {
    const result = await this.entityManager.query(
      `UPDATE "otp_verifications"
         SET "attempts" = "attempts" + 1
       WHERE "id" = $1 AND "attempts" < $2
       RETURNING "attempts"`,
      [pendingId, maxAttempts],
    );
    // Postgres driver returns [rows, rowCount] for UPDATE ... RETURNING
    const rows = Array.isArray(result?.[0]) ? result[0] : result;
    return rows?.[0]?.attempts ?? null;
  }

  async deletePendingRegistration(id: number): Promise<void> {
    await this.entityManager.query(
      `DELETE FROM "otp_verifications" WHERE "id" = $1`,
      [id],
    );
  }

  async purgeExpiredPendingRegistrations(): Promise<void> {
    await this.entityManager.query(
      `DELETE FROM "otp_verifications" WHERE "expiry" < $1`,
      [new Date()],
    );
  }
}
