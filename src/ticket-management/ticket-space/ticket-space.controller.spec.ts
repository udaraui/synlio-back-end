import { Test, TestingModule } from '@nestjs/testing';
import { TicketSpaceController } from './ticket-space.controller';

describe('TicketSpaceController', () => {
  let controller: TicketSpaceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketSpaceController],
    }).compile();

    controller = module.get<TicketSpaceController>(TicketSpaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
