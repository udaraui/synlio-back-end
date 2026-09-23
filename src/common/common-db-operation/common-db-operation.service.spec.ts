import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { CommonDbOperationService } from './common-db-operation.service';

describe('CommonDbOperationService', () => {
  let service: CommonDbOperationService;

  beforeEach(async () => {
    const mockEntityManager = {
      findOneBy: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          offset: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(0),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommonDbOperationService,
        {
          provide: getEntityManagerToken(),
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<CommonDbOperationService>(CommonDbOperationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
