import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  let service: ScheduleService;

  beforeEach(async () => {
    const mockEntityManager = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockRedisService = {
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: getEntityManagerToken(),
          useValue: mockEntityManager,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
