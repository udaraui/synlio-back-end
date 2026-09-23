import { Test, TestingModule } from '@nestjs/testing';
import { SkillCategoryController } from './skill-category.controller';

describe('SkillCategoryController', () => {
  let controller: SkillCategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillCategoryController],
    }).compile();

    controller = module.get<SkillCategoryController>(SkillCategoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
