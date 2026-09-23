import { Test, TestingModule } from '@nestjs/testing';
import { WorkLogController } from './work-log.controller';

describe('WorkLogController', () => {
  let controller: WorkLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkLogController],
    }).compile();

    controller = module.get<WorkLogController>(WorkLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
