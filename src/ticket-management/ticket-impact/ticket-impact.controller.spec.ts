import { Test, TestingModule } from '@nestjs/testing';
import { TicketImpactController } from './ticket-impact.controller';

describe('TicketImpactController', () => {
  let controller: TicketImpactController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketImpactController],
    }).compile();

    controller = module.get<TicketImpactController>(TicketImpactController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
