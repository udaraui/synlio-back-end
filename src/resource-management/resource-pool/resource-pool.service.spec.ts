import { Test, TestingModule } from '@nestjs/testing';
import { ResourcePoolService } from './resource-pool.service';

describe('ResourcePoolService', () => {
  let service: ResourcePoolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResourcePoolService],
    }).compile();

    service = module.get<ResourcePoolService>(ResourcePoolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
