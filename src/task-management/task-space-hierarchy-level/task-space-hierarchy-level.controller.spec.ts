import { Test, TestingModule } from '@nestjs/testing';
import { TaskSpaceHierarchyLevelController } from './task-space-hierarchy-level.controller';

describe('TaskSpaceHierarchyLevelController', () => {
  let controller: TaskSpaceHierarchyLevelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskSpaceHierarchyLevelController],
    }).compile();

    controller = module.get<TaskSpaceHierarchyLevelController>(TaskSpaceHierarchyLevelController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
