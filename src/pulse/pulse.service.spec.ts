import { Test, TestingModule } from '@nestjs/testing';
import { PulseService } from './pulse.service';

describe('PulseService', () => {
  let service: PulseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PulseService],
    }).compile();

    service = module.get<PulseService>(PulseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
