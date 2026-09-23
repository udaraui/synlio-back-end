import { Module } from '@nestjs/common';
import { WorkLogController } from './work-log.controller';
import { WorkLogService } from './work-log.service';
import { CommonModule } from '../common/common.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TaskManagementModule } from '../task-management/task-management.module';

@Module({
  imports: [CommonModule, AuthorizationModule, TaskManagementModule],
  controllers: [WorkLogController],
  providers: [WorkLogService],
})
export class WorkLogModule {}
