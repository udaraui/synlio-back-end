/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { TmTaskLabel } from './task-label.entity';
import {
  AssignTmTaskLabelsDto,
  CreateTmTaskLabelDto,
  UpdateTmTaskLabelDto,
} from './dto/task-label.dto';
import { Task } from '../task/task.entity';
import { TaskSpace } from '../task-space/task-space.entity';

@Injectable()
export class TmTaskLabelService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async create(
    dto: CreateTmTaskLabelDto,
    authUser?: any,
  ): Promise<TmTaskLabel> {
    return this.entityManager.transaction(async (manager) => {
      const taskSpace = await manager.findOne(TaskSpace, {
        where: { id: dto.taskSpaceId },
      });
      if (!taskSpace) {
        throw new HttpException(
          `TaskSpace with ID ${dto.taskSpaceId} not found`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const label = manager.create(TmTaskLabel, {
        name: dto.name,
        taskSpaceId: dto.taskSpaceId,
        createdBy: authUser?.email as string,
        createdAt: new Date(),
      });

      return manager.save(TmTaskLabel, label);
    });
  }

  async assignAndCreateLabels(
    dto: AssignTmTaskLabelsDto,
    authUser?: any,
  ): Promise<Task> {
    return this.entityManager.transaction(async (manager) => {
      const { taskId, existingLabelIds = [], newLabelNames = [] } = dto;

      const task = await manager.findOne(Task, {
        where: { id: taskId },
        relations: ['labels'],
      });

      if (!task) {
        throw new HttpException(
          `Task with ID ${taskId} not found`,
          HttpStatus.BAD_REQUEST,
        );
      }

      let finalLabels: TmTaskLabel[] = [];

      if (existingLabelIds.length > 0) {
        const existing = await manager.findBy(TmTaskLabel, {
          id: In(existingLabelIds),
        });
        finalLabels = [...finalLabels, ...existing];
      }

      if (newLabelNames.length > 0) {
        const newLabels = newLabelNames.map((name) =>
          manager.create(TmTaskLabel, {
            name,
            taskSpaceId: task.taskSpaceId,
            createdBy: authUser?.email as string,
            createdAt: new Date(),
          }),
        );

        const saved = await manager.save(TmTaskLabel, newLabels);
        finalLabels = [...finalLabels, ...saved];
      }

      task.labels = finalLabels;
      task.updatedBy = authUser?.email as string;
      task.updatedAt = new Date();

      return manager.save(Task, task);
    });
  }

  async findByTaskSpace(taskSpaceId: number): Promise<TmTaskLabel[]> {
    return this.entityManager.find(TmTaskLabel, {
      where: { taskSpaceId },
      order: { name: 'ASC' },
    });
  }

  async update(
    id: number,
    dto: UpdateTmTaskLabelDto,
    authUser?: any,
  ): Promise<TmTaskLabel> {
    return this.entityManager.transaction(async (manager) => {
      const label = await manager.findOne(TmTaskLabel, { where: { id } });

      if (!label) {
        throw new NotFoundException(`TaskLabel with ID ${id} not found`);
      }

      label.name = dto.name;
      label.updatedBy = authUser?.email as string;
      label.updatedAt = new Date();

      return manager.save(TmTaskLabel, label);
    });
  }

  async delete(id: number): Promise<{ success: boolean; message: string }> {
    return this.entityManager.transaction(async (manager) => {
      const label = await manager.findOne(TmTaskLabel, { where: { id } });

      if (!label) {
        throw new NotFoundException(`TaskLabel with ID ${id} not found`);
      }

      await manager.remove(TmTaskLabel, label);

      return { success: true, message: 'Label deleted' };
    });
  }
}
