import { Module } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { SkillService } from './skill.service';
import { AuthorizationModule } from '../../../authorization/authorization.module';
import { CommonDbOperationService } from '../../../common/common-db-operation/common-db-operation.service';
import { CommonModule } from '../../../common/common.module';

@Module({
  controllers: [SkillController],
  providers: [SkillService, CommonDbOperationService],
  imports: [AuthorizationModule, CommonModule],
})
export class SkillModule {}
