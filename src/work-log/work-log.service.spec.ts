import { Test, TestingModule } from '@nestjs/testing';
import { WorkLogService } from './work-log.service';

describe('WorkLogService', () => {
  let service: WorkLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkLogService],
    }).compile();

    service = module.get<WorkLogService>(WorkLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
