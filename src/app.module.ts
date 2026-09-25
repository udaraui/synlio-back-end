import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UserManagementModule } from './user-management/user-management.module';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './company-management/company/company.module';
import { CompanyManagementModule } from './company-management/company-management.module';
import { ResourceManagementModule } from './resource-management/resource-management.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from './schedule/schedule.module';
import { TicketManagementModule } from './ticket-management/ticket-management.module';
import { CommentModule } from './comment/comment.module';
import { AlertModule } from './alert/alert.module';
import { TaskManagementModule } from './task-management/task-management.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SyanalyticsModule } from './synalytics/synalytics.module';
import { NotesModule } from './notes/notes.module';
import { PulseModule } from './pulse/pulse.module';
import { WorkLogModule } from './work-log/work-log.module';
import { ExportExcelModule } from './export/excel/export-excel.module';
import { MeetingsIntegrationModule } from './meetings-integration/meetings-integration.module';
import { LinkManagementModule } from './link-management/link-management.module';
import { ChatModule } from './chat/chat.module';
import { FilterTemplateModule } from './filter-template/filter-template.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UserManagementModule,
    CompanyModule,
    CompanyManagementModule,
    ResourceManagementModule,
    RedisModule,
    CommonModule,
    AuthorizationModule,
    AuthModule,
    ScheduleModule,
    TicketManagementModule,
    CommentModule,
    AlertModule,
    TaskManagementModule,
    DashboardModule,
    SyanalyticsModule,
    NotesModule,
    PulseModule,
    WorkLogModule,
    ExportExcelModule,
    MeetingsIntegrationModule,
    LinkManagementModule,
    ChatModule,
    FilterTemplateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
