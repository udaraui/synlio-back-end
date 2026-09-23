import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Division } from './division.entity';
import { CreateDivisionDto, UpdateDivisionDto } from './dto/division.dto';
import { Company } from '../company/company.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { User } from '../../user-management/user/user.entity';

@Injectable()
export class DivisionService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  getAllDivisions(activeCompanyId?: number) {
    const where: any = { isActive: true };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    return this.entityManager.find(Division, {
      where,
      order: { id: 'asc' },
      relations: ['company'],
    });
  }

  getAllDivisionsByCompanyId(companyId: number) {
    // If companyId is passed, it should already be the activeCompanyId from the controller
    return this.entityManager.find(Division, {
      where: { companyId: companyId, isActive: true },
      order: { id: 'asc' },
      relations: ['company'],
    });
  }

  createDivision(division: CreateDivisionDto, authUser: any, activeCompanyId?: number) {
    let newDivision: Division = new Division();
    newDivision = {
      ...division,
      users: [],
      resources: [],
      company: undefined as unknown as Company,
      resourcepools: [],
    };

    // Security: Force companyId to activeCompanyId if provided
    if (activeCompanyId && activeCompanyId !== 0) {
      newDivision.companyId = activeCompanyId;
    }

    newDivision.isActive = true;
    newDivision.createdBy = authUser.email;
    return this.entityManager.save(Division, newDivision);
  }

  async updateDivision(
    id: number,
    divisionDto: UpdateDivisionDto,
    authUser: any,
    activeCompanyId?: number,
  ): Promise<Division> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const existingDivision = await this.entityManager.findOne(Division, {
      where,
    });

    if (!existingDivision) {
      throw new Error(`Division with ID ${id} not found.`);
    }

    const mergedDivision = this.entityManager.merge(
      Division,
      existingDivision,
      divisionDto,
    );

    mergedDivision.updatedBy = authUser.email;

    return this.entityManager.save(mergedDivision);
  }

  async disableDivision(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const division = await this.entityManager.findOne(Division, {
      where,
    });

    if (!division) {
      throw new NotFoundException(`Division with ID ${id} not found`);
    }

    const newIsActiveStatus = !division.isActive;

    await this.entityManager.update(Division, where, {
      isActive: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    return {
      message: `Division status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async deleteDivision(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.companyId = activeCompanyId;
    }

    const division = await this.entityManager.findOne(Division, { where });
    if (!division) {
      throw new NotFoundException(`Division with ID ${id} not found`);
    }

    const resourceRepository = this.entityManager.getRepository(Resource);
    const resourcePoolRepository =
      this.entityManager.getRepository(ResourcePool);
    const userRepository = this.entityManager.getRepository(User);

    const [
      relatedResourcesCount,
      relatedResourcePoolsCount,
      relatedUsersCount,
    ] = await Promise.all([
      resourceRepository.count({ where: { division: { id } } }),
      resourcePoolRepository.count({ where: { division: { id } } }),
      userRepository.count({
        where: { divisions: { id } },
      }),
    ]);

    // Sum up all associated records
    const totalAssociatedRecords =
      relatedResourcesCount +
      relatedResourcePoolsCount +
      relatedUsersCount;

    // If children exist, return an error message
    if (totalAssociatedRecords > 0) {
      const errorDetails: string[] = [];

      if (relatedResourcesCount > 0) {
        errorDetails.push(`- ${relatedResourcesCount} associated resource(s)`);
      }
      if (relatedResourcePoolsCount > 0) {
        errorDetails.push(
          `- ${relatedResourcePoolsCount} associated resource pool(s)`,
        );
      }
      if (relatedUsersCount > 0) {
        errorDetails.push(`- ${relatedUsersCount} associated user(s)`);
      }

      const detailedMessage = `Division is currently linked to the following entities:\n${errorDetails.join('\n')}\n\nPlease unassign this division from all related records first`;

      return {
        error: 'Cannot delete division due to active relationships',
        message: detailedMessage,
        status: 402,
      };
    }

    // If no children exist, proceed with deletion
    await this.entityManager.delete(Division, where);

    return {
      message: 'Division deleted',
      status: 200,
    };
  }
}
