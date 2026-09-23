import { Test, TestingModule } from '@nestjs/testing';
import { TicketSpaceMemberController } from './ticket-space-member.controller';

describe('TicketSpaceMemberController', () => {
  let controller: TicketSpaceMemberController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketSpaceMemberController],
    }).compile();

    controller = module.get<TicketSpaceMemberController>(
      TicketSpaceMemberController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
