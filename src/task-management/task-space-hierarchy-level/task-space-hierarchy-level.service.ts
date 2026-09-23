import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TaskSpaceHierarchyLevel } from './task-space-hierarchy-level.entity';
import {
  CreateTaskSpaceHierarchyLevelDto,
  UpdateTaskSpaceHierarchyLevelDto,
} from './dto/task-space-hierarchy-level.dto';

@Injectable()
export class TaskSpaceHierarchyLevelService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  getAll() {
    return this.entityManager.find(TaskSpaceHierarchyLevel, {
      order: { sequence: 'ASC' },
    });
  }

  async getById(id: number) {
    const level = await this.entityManager.findOne(TaskSpaceHierarchyLevel, {
      where: { id },
    });
    if (!level) {
      throw new NotFoundException(`Hierarchy level with ID ${id} not found`);
    }
    return level;
  }

  async create(dto: CreateTaskSpaceHierarchyLevelDto, authUser: any) {
    const level = new TaskSpaceHierarchyLevel();
    level.sequence = dto.sequence;
    level.name = dto.name;
    level.icon = dto.icon ?? 'Folder';
    level.color = dto.color ?? '#6366f1';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    level.createdBy = authUser.email as string;
    return this.entityManager.save(TaskSpaceHierarchyLevel, level);
  }

  async update(id: number, dto: UpdateTaskSpaceHierarchyLevelDto, authUser: any) {
    const level = await this.entityManager.findOne(TaskSpaceHierarchyLevel, {
      where: { id },
    });
    if (!level) {
      throw new NotFoundException(`Hierarchy level with ID ${id} not found`);
    }
    if (dto.sequence !== undefined) level.sequence = dto.sequence;
    if (dto.name !== undefined) level.name = dto.name;
    if (dto.icon !== undefined) level.icon = dto.icon;
    if (dto.color !== undefined) level.color = dto.color;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    level.updatedBy = authUser.email as string;
    return this.entityManager.save(TaskSpaceHierarchyLevel, level);
  }

  async delete(id: number): Promise<{ message: string }> {
    const level = await this.entityManager.findOne(TaskSpaceHierarchyLevel, {
      where: { id },
    });
    if (!level) {
      throw new NotFoundException(`Hierarchy level with ID ${id} not found`);
    }
    await this.entityManager.delete(TaskSpaceHierarchyLevel, id);
    return { message: 'Hierarchy level deleted' };
  }
}

