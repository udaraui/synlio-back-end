import { Test, TestingModule } from '@nestjs/testing';
import { PulseController } from './pulse.controller';

describe('PulseController', () => {
  let controller: PulseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PulseController],
    }).compile();

    controller = module.get<PulseController>(PulseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
