import { Test, TestingModule } from '@nestjs/testing';
import { TicketImpactService } from './ticket-impact.service';

describe('TicketImpactService', () => {
  let service: TicketImpactService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketImpactService],
    }).compile();

    service = module.get<TicketImpactService>(TicketImpactService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
