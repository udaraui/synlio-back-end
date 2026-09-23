import { Module } from '@nestjs/common';
import { SkillCategoryController } from './skill-category.controller';
import { SkillCategoryService } from './skill-category.service';
import { AuthorizationModule } from '../../../authorization/authorization.module';
import { CommonDbOperationService } from '../../../common/common-db-operation/common-db-operation.service';
import { CommonModule } from '../../../common/common.module';

@Module({
  controllers: [SkillCategoryController],
  providers: [SkillCategoryService, CommonDbOperationService],
  imports: [AuthorizationModule, CommonModule],
})
export class SkillCategoryModule {}
