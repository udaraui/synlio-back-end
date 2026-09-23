import { Test, TestingModule } from '@nestjs/testing';
import { TaskSpaceService } from './task-space.service';

describe('TaskSpaceService', () => {
  let service: TaskSpaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskSpaceService],
    }).compile();

    service = module.get<TaskSpaceService>(TaskSpaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
