import { Module } from '@nestjs/common';
import { TaskManagementModule } from '../task-management/task-management.module';
import { TicketManagementModule } from '../ticket-management/ticket-management.module';
import { CommonModule } from '../common/common.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    CommonModule,
    AuthorizationModule,
    TaskManagementModule,
    TicketManagementModule,
  ],
  controllers: [DashboardController],
  providers: [],
})
export class DashboardModule {}
