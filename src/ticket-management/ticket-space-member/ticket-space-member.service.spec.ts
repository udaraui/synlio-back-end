import { Test, TestingModule } from '@nestjs/testing';
import { TicketSpaceMemberService } from './ticket-space-member.service';

describe('TicketSpaceMemberService', () => {
  let service: TicketSpaceMemberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketSpaceMemberService],
    }).compile();

    service = module.get<TicketSpaceMemberService>(TicketSpaceMemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
