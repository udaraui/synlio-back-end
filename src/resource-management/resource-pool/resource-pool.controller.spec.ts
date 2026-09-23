import { Test, TestingModule } from '@nestjs/testing';
import { ResourcePoolController } from './resource-pool.controller';

describe('ResourcePoolController', () => {
  let controller: ResourcePoolController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourcePoolController],
    }).compile();

    controller = module.get<ResourcePoolController>(ResourcePoolController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
