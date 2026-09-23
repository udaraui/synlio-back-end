import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyanalyticsController } from './synalytics.controller';
import { SyanalyticsService } from './synalytics.service';
import { VwTicketDashboard } from './entities/vw-ticket-dashboard.entity';
import { VwTicketStatusKpi } from './entities/vw-ticket-status-kpi.entity';
import { VwTicketWorkload } from './entities/vw-ticket-workload.entity';
import { VwTicketRecentList } from './entities/vw-ticket-recent-list.entity';
import { VwProjectDashboard } from './entities/vw-project-dashboard.entity';
import { VwProjectTaskDetail } from './entities/vw-project-task-detail.entity';
import { VwResourceDashboard } from './entities/vw-resource-dashboard.entity';
import { VwResourceSkillGap } from './entities/vw-resource-skill-gap.entity';
import { VwTicketDailyActivity } from './entities/vw-ticket-daily-activity.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VwTicketDashboard,
      VwTicketStatusKpi,
      VwTicketWorkload,
      VwTicketRecentList,
      VwProjectDashboard,
      VwProjectTaskDetail,
      VwResourceDashboard,
      VwResourceSkillGap,
      VwTicketDailyActivity,
    ]),
  ],
  controllers: [SyanalyticsController],
  providers: [SyanalyticsService],
})
export class SyanalyticsModule {}