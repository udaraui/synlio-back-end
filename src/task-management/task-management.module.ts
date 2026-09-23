import { Module } from '@nestjs/common';
import { TaskSpaceController } from './task-space/task-space.controller';
import { TaskSpaceService } from './task-space/task-space.service';
import { TaskSpaceHierarchyLevelController } from './task-space-hierarchy-level/task-space-hierarchy-level.controller';
import { TaskSpaceHierarchyLevelService } from './task-space-hierarchy-level/task-space-hierarchy-level.service';
import { TmTaskController } from './task/task.controller';
import { TmTaskService } from './task/task.service';
import { TmTaskLabelController } from './task-label/task-label.controller';
import { TmTaskLabelService } from './task-label/task-label.service';
import { TmTaskChecklistController } from './task-checklist/task-checklist.controller';
import { ChecklistService } from '../common/checklist/checklist.service';
import { CommonDbOperationService } from '../common/common-db-operation/common-db-operation.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CommonModule } from '../common/common.module';
import { TaskAlertService } from './task-alert/task-alert.service';
import { AlertModule } from '../alert/alert.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [CommonModule, AuthorizationModule, AlertModule, RedisModule],
  controllers: [
    TaskSpaceController,
    TaskSpaceHierarchyLevelController,
    TmTaskController,
    TmTaskLabelController,
    TmTaskChecklistController,
  ],
  providers: [
    TaskSpaceService,
    TaskSpaceHierarchyLevelService,
    TmTaskService,
    TmTaskLabelService,
    ChecklistService,
    CommonDbOperationService,
    TaskAlertService,
  ],
  exports: [TaskAlertService, TmTaskService],
})
export class TaskManagementModule {}
