import { Test, TestingModule } from '@nestjs/testing';
import { TicketSpaceService } from './ticket-space.service';

describe('TicketSpaceService', () => {
  let service: TicketSpaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketSpaceService],
    }).compile();

    service = module.get<TicketSpaceService>(TicketSpaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
