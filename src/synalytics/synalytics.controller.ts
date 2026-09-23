import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { SyanalyticsService } from './synalytics.service';
import { TicketAnalyticsQueryDto } from './dto/ticket-analytics-query.dto';
import { ProjectAnalyticsQueryDto } from './dto/project-analytics-query.dto';
import { ResourceAnalyticsQueryDto } from './dto/resource-analytics-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('synalytics')
export class SyanalyticsController {
  constructor(private readonly service: SyanalyticsService) {}

  @Post('ticket/dashboard')
  getTicketDashboard(@Body() dto: TicketAnalyticsQueryDto) {
    return this.service.getTicketDashboard(dto);
  }

  @Post('ticket/status-kpi')
  getTicketStatusKpi(@Body() dto: TicketAnalyticsQueryDto) {
    return this.service.getTicketStatusKpi(dto);
  }
  
  @Post('ticket/daily-activity')
  getTicketDailyActivity(@Body() dto: TicketAnalyticsQueryDto) {
    return this.service.getTicketDailyActivity(dto);
  }

  @Post('ticket/workload')
  getTicketWorkload(@Body() dto: TicketAnalyticsQueryDto) {
    return this.service.getTicketWorkload(dto);
  }

  @Post('ticket/recent-list')
  getTicketRecentList(@Body() dto: TicketAnalyticsQueryDto) {
    return this.service.getTicketRecentList(dto);
  }

  // ── Project Analytics ────────────────────────────────────────────────────

  @Post('project/dashboard')
  getProjectDashboard(@Body() dto: ProjectAnalyticsQueryDto) {
    return this.service.getProjectDashboard(dto);
  }

  @Post('project/task-detail')
  getProjectTaskDetail(@Body() dto: ProjectAnalyticsQueryDto) {
    return this.service.getProjectTaskDetail(dto);
  }

  // ── Resource Analytics ───────────────────────────────────────────────────

  @Post('resource/dashboard')
  getResourceDashboard(@Body() dto: ResourceAnalyticsQueryDto) {
    return this.service.getResourceDashboard(dto);
  }

  @Post('resource/skill-gap')
  getResourceSkillGap(@Body() dto: ResourceAnalyticsQueryDto) {
    return this.service.getResourceSkillGap(dto);
  }
}