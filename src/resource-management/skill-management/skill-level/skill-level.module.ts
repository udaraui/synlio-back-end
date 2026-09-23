import { Module } from '@nestjs/common';
import { SkillLevelController } from './skill-level.controller';
import { SkillLevelService } from './skill-level.service';
import { CommonDbOperationService } from '../../../common/common-db-operation/common-db-operation.service';
import { CommonModule } from '../../../common/common.module';
import { AuthorizationModule } from '../../../authorization/authorization.module';

@Module({
  controllers: [SkillLevelController],
  providers: [SkillLevelService, CommonDbOperationService],
  imports: [AuthorizationModule, CommonModule],
})
export class SkillLevelModule {}
