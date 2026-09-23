import { Test, TestingModule } from '@nestjs/testing';
import { TaskSpaceController } from './task-space.controller';

describe('TaskSpaceController', () => {
  let controller: TaskSpaceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskSpaceController],
    }).compile();

    controller = module.get<TaskSpaceController>(TaskSpaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
