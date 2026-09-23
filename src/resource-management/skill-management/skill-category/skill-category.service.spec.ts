import { Test, TestingModule } from '@nestjs/testing';
import { SkillCategoryService } from './skill-category.service';

describe('SkillCategoryService', () => {
  let service: SkillCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SkillCategoryService],
    }).compile();

    service = module.get<SkillCategoryService>(SkillCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
