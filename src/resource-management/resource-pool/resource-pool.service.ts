import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ResourcePool } from './resource-pool.entity';
import { Resource } from '../resource/resource.entity';
import {
  CreateResourcePool,
  UpdateResourcePoolDto,
} from './dto/resource-pool.dto';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { User } from '../../user-management/user/user.entity';
import { Calendar } from '../calendar/calendar.entity';

@Injectable()
export class ResourcePoolService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  async createResourcePool(resource_pool: CreateResourcePool, authUser: any, activeCompanyId?: number) {
    const resourcePool = new ResourcePool();
    resourcePool.name = resource_pool.name;

    // Security: If not system admin, force the pool to the active company
    const targetCompanyId = (activeCompanyId && activeCompanyId !== 0) 
      ? activeCompanyId 
      : Number(resource_pool.company);

    resourcePool.company = { id: targetCompanyId } as Company;
    resourcePool.division = { id: resource_pool.division } as Division;
    resourcePool.pool_owner = { id: resource_pool.pool_owner } as User;
    resourcePool.createdBy = authUser?.email ?? authUser?.id ?? null;

    const resourceItems = Array.isArray(resource_pool.resources)
      ? resource_pool.resources
      : resource_pool.resources
        ? [resource_pool.resources]
        : [];

    resourcePool.resources = resourceItems
      .map((item) => {
        const id = typeof item === 'number' ? item : (item as Resource)?.id;
        return id ? ({ id } as Resource) : null;
      })
      .filter((item): item is Resource => item !== null);

    return this.entityManager.save(ResourcePool, resourcePool);
  }

  async updateResourcePool(
    id: number,
    resource_pool: UpdateResourcePoolDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    // 1. Fetch the existing pool to ensure it exists and belongs to the company
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const existingPool = await this.entityManager.findOne(ResourcePool, {
      where,
      relations: ['resources'], // Important: Load current resources so TypeORM can diff/update them
    });

    if (!existingPool) {
      throw new NotFoundException(`Resource Pool with ID ${id} not found`);
    }

    if (resource_pool.name) {
      existingPool.name = resource_pool.name;
    }

    existingPool.updatedBy = authUser.email;

    // 4. Update Single Relations (Company, Division, Owner)
    // We map the incoming ID (number) to an object entity stub { id: ... }
    if (resource_pool.company) {
      existingPool.company = { id: resource_pool.company } as Company;
    }

    if (resource_pool.division) {
      existingPool.division = { id: resource_pool.division } as Division;
    }

    if (resource_pool.pool_owner) {
      existingPool.pool_owner = { id: resource_pool.pool_owner } as User;
    }

    // 5. Update Many-to-Many Resources
    // We check if resources are provided in the payload before updating
    if (resource_pool.resources !== undefined) {
      const resourceItems = Array.isArray(resource_pool.resources)
        ? resource_pool.resources
        : resource_pool.resources
          ? [resource_pool.resources]
          : [];

      // Map IDs (or objects) to Resource Entities
      existingPool.resources = resourceItems
        .map((item) => {
          // Handle if input is just ID (number) or object ({id: 1})
          const rId = typeof item === 'number' ? item : (item as any)?.id;
          return rId ? ({ id: rId } as Resource) : null;
        })
        .filter((item): item is Resource => item !== null);
    }

    // 6. Save the changes
    return this.entityManager.save(ResourcePool, existingPool);
  }
  async getById(id: number, activeCompanyId?: number): Promise<any> {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const pool = await this.entityManager.findOne(ResourcePool, {
      where,
      relations: ['pool_owner', 'division', 'company'],
    });
    if (!pool) {
      throw new NotFoundException(`Pool with ID ${id} not found`);
    }

    return pool;
  }

  async getByCompanyAndDivision(
    companyId: number,
    divisionId: number,
  ): Promise<any> {
    const pools = await this.entityManager.find(ResourcePool, {
      where: {
        company: { id: companyId },
        division: { id: divisionId },
        isActive: true,
      },
      relations: [
        'pool_owner',
        'division',
        'company',
        'resources',
        'resources.resourceSkills',
        'resources.resourceSkills.skill',
        'resources.resourceSkills.skillLevel',
        'resources.resourceSkills.skillCategory',
      ],
    });

    return pools;
  }

  async disable(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const pool = await this.entityManager.findOne(ResourcePool, {
      where,
    });

    if (!pool) {
      throw new NotFoundException(`Pool with ID ${id} not found`);
    }

    const newIsActiveStatus = !pool.isActive;

    await this.entityManager.update(ResourcePool, id, {
      isActive: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    return {
      message: `Resource Pool status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async delete(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const pool = await this.entityManager.findOne(ResourcePool, {
      where,
    });

    if (!pool) {
      throw new Error(`Resource Pool with ID ${id} not found`);
    }

    await this.entityManager.remove(pool);

    return { message: `Resource Pool ${id} permanently deleted` };
  }
}
