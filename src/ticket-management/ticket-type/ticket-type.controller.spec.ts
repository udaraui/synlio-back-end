import { Test, TestingModule } from '@nestjs/testing';
import { TicketTypeController } from './ticket-type.controller';

describe('TicketTypeController', () => {
  let controller: TicketTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketTypeController],
    }).compile();

    controller = module.get<TicketTypeController>(TicketTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
