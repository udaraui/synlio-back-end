import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { EntityManager, In } from 'typeorm';
import { Privilege } from '../privilege/privilege.entity';
import { CreateRoleDto, ResponseRoleDto, UpdateRoleDto } from './dto/role.dto';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { UserCompanyRole } from '../user/user-company-role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async getAllrole(activeCompanyId?: number): Promise<ResponseRoleDto[]> {
    const where: any = { isActive: true };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const roles = await this.entityManager.find(Role, {
      where,
      order: { id: 'ASC' },
      relations: ['companyId', 'privileges', 'userCompanyRoles'],
    });
    return roles as ResponseRoleDto[];
  }

  async getAllroleByCompany(companyId: number): Promise<ResponseRoleDto[]> {
    const roles = await this.entityManager.find(Role, {
      where: { companyId: companyId, isActive: true },
      relations: ['company', 'privileges', 'userCompanyRoles'],
    });
    return roles as ResponseRoleDto[];
  }

  async getActiveUserCompanyRoles(userId: number): Promise<UserCompanyRole[]> {
    return this.entityManager.find(UserCompanyRole, {
      where: { userId: userId },
      relations: ['user', 'company', 'role'],
      order: { id: 'ASC' },
    });
  }

  async createRole(
    createRoleDto: CreateRoleDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<ResponseRoleDto> {
    const { role } = createRoleDto;

    // Security: If not system admin, force the role to the active company
    const targetCompanyId = (activeCompanyId && activeCompanyId !== 0) 
      ? activeCompanyId 
      : Number(createRoleDto.companyId);

    // 1. Check if a role with the same name already exists in this company
    const existingRole = await this.entityManager.findOne(Role, {
      where: {
        role: role,
        companyId: targetCompanyId,
      },
    });

    if (existingRole) {
      if (existingRole.isActive) {
        throw new HttpException(
          `Role "${role}" already exists for this company`,
          HttpStatus.BAD_REQUEST,
        );
      } else {
        // Reactivate and update
        existingRole.isActive = true;

        existingRole.updatedBy = authUser.email;
        const reactivatedRole = await this.entityManager.save(Role, existingRole);
        return reactivatedRole as ResponseRoleDto;
      }
    }

    // 2. Find the company
    const company = await this.entityManager.findOne(Company, {
      where: { id: targetCompanyId },
    });

    if (!company) {
      throw new HttpException(
        `Sorry, the company doesn't exist`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Create new role
    const savedRole = await this.entityManager.save(Role, {
      role,

      company: company,
      companyId: targetCompanyId,
      createdBy: authUser.email,
      isActive: true,
    });

    return savedRole as ResponseRoleDto;
  }

  async disableRole(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }
    const role = await this.entityManager.findOne(Role, { where });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    const newIsActiveStatus = !role.isActive;

    await this.entityManager.update(Role, id, {
      isActive: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    await this.authorizationService.invalidateCacheForRole(id);

    return {
      message: `Division status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async deleteRole(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existingRole = await this.entityManager.findOne(Role, { where });
    if (!existingRole) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Repositories for blocking relationships
    const userCompanyRoleRepository =
      this.entityManager.getRepository(UserCompanyRole);
    const privilegeRepository = this.entityManager.getRepository(Privilege);

    // Concurrently count related entities in all relationships
    const [relatedUCRCount] = await Promise.all([
      // 1. Check UserCompanyRole relationship (OneToMany)
      userCompanyRoleRepository.count({
        where: { role: { id } },
      }),

    ]);

    const totalAssociatedRecords = relatedUCRCount;

    // If children exist, return the detailed error message
    if (totalAssociatedRecords > 0) {
      const errorDetails: string[] = [];

      if (relatedUCRCount > 0) {
        errorDetails.push(
          `- ${relatedUCRCount} associated user company role(s)`,
        );
      }

      const detailedMessage = `Role is currently linked to the following entities:\n${errorDetails.join('\n')}\n\nPlease unassign this role from all related records first`;

      return {
        error: 'Cannot delete role due to active relationships',
        message: detailedMessage,
        status: 400,
      };
    }

    // If no children exist, proceed with deletion
    await this.entityManager.delete(Role, id);

    return {
      message: 'Role deleted',
      status: 200,
    };
  }

  async updateRole(id: number, updateRoleDto: UpdateRoleDto, authUser: any, activeCompanyId?: number) {
    const { role, companyId, isActive } = updateRoleDto;

    // First, find the existing role with its relations
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existingRole = await this.entityManager.findOne(Role, {
      where,
      relations: ['company'],
    });

    if (!existingRole) {
      throw new HttpException(
        `Sorry, the role doesn't exist`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update basic fields
    if (role !== undefined) {
      existingRole.role = role;
    }


    // Find and update company if provided
    if (companyId !== undefined) {
      const company = await this.entityManager.findOne(Company, {
        where: { id: companyId },
      });
      if (!company) {
        throw new HttpException(
          `Sorry, the company doesn't exist`,
          HttpStatus.BAD_REQUEST,
        );
      }
      existingRole.companyId = companyId;
    }

    if (isActive !== undefined) {
      existingRole.isActive = isActive;
    }

    existingRole.updatedBy = authUser.email;
    // Save the updated role
    await this.entityManager.save(Role, existingRole);

    // Invalidate Redis cache for all users who have this role
    await this.authorizationService.invalidateCacheForRole(id);

    return { message: 'Role updated' };
  }

  async getRoleById(id: number, activeCompanyId?: number): Promise<ResponseRoleDto> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const role = await this.entityManager.findOne(Role, {
      where,
      relations: ['company', 'privileges'],
    });
    if (role) {
      return role as ResponseRoleDto;
    } else {
      throw new HttpException(
        `Sorry, the role doesn't exist`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async assignPrivilegeToRole(
    roleId: number,
    privilegeIds: number | number[],
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id: roleId };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const role = await this.entityManager.findOne(Role, {
      where,
      relations: ['privileges', 'userCompanyRoles'],
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Ensure privilegeIds is always an array
    const privilegeIdsArray = Array.isArray(privilegeIds)
      ? privilegeIds
      : [privilegeIds];

    // Validate all privilege IDs exist
    const privileges = await this.entityManager.find(Privilege, {
      where: { id: In(privilegeIdsArray) },
    });
    const foundPrivilegeIds = privileges.map((p) => p.id);
    const notFoundIds = privilegeIdsArray.filter(
      (id) => !foundPrivilegeIds.includes(id),
    );

    if (notFoundIds.length > 0) {
      throw new HttpException(
        `Privileges not found: ${notFoundIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Prevent assigning 'env' level privileges to company roles
    if (role.companyId !== null && role.companyId !== undefined) {
      const hasEnvPrivilege = privileges.some((p) => p.level_type === 'env');
      
      // We only block this if the action is ASSIGNING the privilege,
      // but the UI currently TOGGLES the privilege. 
      // If a role accidentally has an env privilege, we should still allow it to be REMOVED.
      // So let's check which env privileges are being ADDED.
      const addingEnvPrivileges = privileges.filter(
        (p) => p.level_type === 'env' && !role.privileges.some((existing) => existing.id === p.id)
      );

      if (addingEnvPrivileges.length > 0) {
        throw new HttpException(
          `Cannot assign environment level privileges to a company role`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Process each privilege - toggle behavior (add if not exists, remove if exists)
    for (const privilegeId of privilegeIdsArray) {
      const existingPrivilegeIndex = role.privileges.findIndex(
        (p) => p.id === privilegeId,
      );

      if (existingPrivilegeIndex >= 0) {
        // Privilege exists, remove it
        role.privileges.splice(existingPrivilegeIndex, 1);
      } else {
        // Privilege doesn't exist, add it
        const privilege = privileges.find((p) => p.id === privilegeId);
        if (privilege) {
          role.privileges.push(privilege);
        }
      }
    }

    role.updatedBy = authUser.email;

    const savedRole = await this.entityManager.save(Role, role);

    // Invalidate Redis cache for all users who have this role
    await this.authorizationService.invalidateCacheForRole(roleId);

    return savedRole;
  }

  async findIdsByNames(names: string[], companyId: number): Promise<any> {
    if (!names || names.length === 0) return [];

    const uniqueNames = [...new Set(names)];

    const roles = await this.entityManager.find(Role,{
      where: {
        role: In(uniqueNames),
        companyId: companyId,
        isActive: true,
      },
      select: ['id', 'role'], 
    });

    if (roles.length !== uniqueNames.length) {
      const foundNames = roles.map((r) => r.role);
      const missingNames = uniqueNames.filter((name) => !foundNames.includes(name));
      
      throw new BadRequestException(
        `The following role(s) do not exist or are inactive: "${missingNames.join(', ')}"`
      );
    }

    return roles.map((r) => r.id);
  }
}
