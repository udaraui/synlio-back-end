import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VwTicketDashboard } from './entities/vw-ticket-dashboard.entity';
import { VwTicketStatusKpi } from './entities/vw-ticket-status-kpi.entity';
import { VwTicketDailyActivity } from './entities/vw-ticket-daily-activity.entity';
import { VwTicketWorkload } from './entities/vw-ticket-workload.entity';
import { VwTicketRecentList } from './entities/vw-ticket-recent-list.entity';
import { TicketAnalyticsQueryDto } from './dto/ticket-analytics-query.dto';
import { VwProjectDashboard } from './entities/vw-project-dashboard.entity';
import { VwProjectTaskDetail } from './entities/vw-project-task-detail.entity';
import { ProjectAnalyticsQueryDto } from './dto/project-analytics-query.dto';
import { VwResourceDashboard } from './entities/vw-resource-dashboard.entity';
import { VwResourceSkillGap } from './entities/vw-resource-skill-gap.entity';
import { ResourceAnalyticsQueryDto } from './dto/resource-analytics-query.dto';

@Injectable()
export class SyanalyticsService {
  constructor(
    @InjectRepository(VwTicketDashboard)
    private readonly dashboardRepo: Repository<VwTicketDashboard>,

    @InjectRepository(VwTicketStatusKpi)
    private readonly statusKpiRepo: Repository<VwTicketStatusKpi>,

    @InjectRepository(VwTicketDailyActivity)
    private readonly dailyActivityRepo: Repository<VwTicketDailyActivity>,

    @InjectRepository(VwTicketWorkload)
    private readonly workloadRepo: Repository<VwTicketWorkload>,

    @InjectRepository(VwTicketRecentList)
    private readonly recentListRepo: Repository<VwTicketRecentList>,

    @InjectRepository(VwProjectDashboard)
    private readonly projectDashboardRepo: Repository<VwProjectDashboard>,

    @InjectRepository(VwProjectTaskDetail)
    private readonly projectTaskDetailRepo: Repository<VwProjectTaskDetail>,

    @InjectRepository(VwResourceDashboard)
    private readonly resourceDashboardRepo: Repository<VwResourceDashboard>,

    @InjectRepository(VwResourceSkillGap)
    private readonly resourceSkillGapRepo: Repository<VwResourceSkillGap>,
  ) {}

  async getTicketDashboard(
    dto: TicketAnalyticsQueryDto,
  ): Promise<VwTicketDashboard[]> {
    const qb = this.dashboardRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId })
      .andWhere('v.ticket_space_id = :spaceId', { spaceId: dto.spaceId })
      .andWhere('v.created_date BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
      });

    return qb.getMany();
  }

  async getTicketStatusKpi(
    dto: TicketAnalyticsQueryDto,
  ): Promise<VwTicketStatusKpi[]> {
    const qb = this.statusKpiRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId })
      .andWhere('v.ticket_space_id = :spaceId', { spaceId: dto.spaceId })
      .andWhere('v.trend_date BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
      });

    qb.orderBy('v.trend_date', 'ASC');

    return qb.getMany();
  }

  async getTicketDailyActivity(
    dto: TicketAnalyticsQueryDto,
  ): Promise<VwTicketDailyActivity[]> {
    const qb = this.dailyActivityRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId })
      .andWhere('v.ticket_space_id = :spaceId', { spaceId: dto.spaceId })
      .andWhere('v.trend_date <= :dateTo', {
        dateTo: dto.dateTo,
      });

    qb.orderBy('v.trend_date', 'ASC');

    return qb.getMany();
  }

  async getTicketWorkload(
    dto: TicketAnalyticsQueryDto,
  ): Promise<VwTicketWorkload[]> {
    const qb = this.workloadRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId })
      .andWhere('v.ticket_space_id = :spaceId', { spaceId: dto.spaceId });

    if (dto.assigneePermissionIds?.length) {
      qb.andWhere('v.assignee_user_id IN (:...assigneePermissionIds)', {
        assigneePermissionIds: dto.assigneePermissionIds,
      });
    }

    qb.orderBy('v.assigned_ticket_count', 'DESC');

    return qb.getMany();
  }

  async getTicketRecentList(
    dto: TicketAnalyticsQueryDto,
  ): Promise<VwTicketRecentList[]> {
    const qb = this.recentListRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId });

    if (dto.spaceId) {
      qb.andWhere('v.ticket_space_id = :spaceId', { spaceId: dto.spaceId });
    }

    if (dto.dateFrom && dto.dateTo) {
      qb.andWhere('v.created_at BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
      });
    }

    if (dto.assigneePermissionIds?.length) {
      qb.andWhere(
        'v.ticket_id IN (SELECT t.id FROM ticket t WHERE t."assigneeId" IN (SELECT tp.id FROM ticket_space_member tp WHERE tp."userId" IN (:...assigneePermissionIds)))',
        { assigneePermissionIds: dto.assigneePermissionIds },
      );
    }

    if (dto.statusBases?.length) {
      qb.andWhere('v.status_base IN (:...statusBases)', {
        statusBases: dto.statusBases,
      });
    }

    qb.orderBy('v.created_at', 'DESC');

    if (dto.limit) {
      qb.limit(dto.limit);
    }

    return qb.getMany();
  }

  // ── Project Analytics ────────────────────────────────────────────────────

  async getProjectDashboard(
    dto: ProjectAnalyticsQueryDto,
  ): Promise<VwProjectDashboard[]> {
    const qb = this.projectDashboardRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId });
    if (dto.taskSpaceId) {
      qb.andWhere('v.task_space_id = :taskSpaceId', {
        taskSpaceId: dto.taskSpaceId,
      });
    }
    return qb.getMany();
  }

  async getProjectTaskDetail(
    dto: ProjectAnalyticsQueryDto,
  ): Promise<VwProjectTaskDetail[]> {
    const qb = this.projectTaskDetailRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId });

    if (dto.taskSpaceId) {
      qb.andWhere('v.task_space_id = :taskSpaceId', {
        taskSpaceId: dto.taskSpaceId,
      });
    }

    if (dto.dateFrom && dto.dateTo) {
      qb.andWhere('v.created_at BETWEEN :dateFrom AND :dateTo', {
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
      });
    }

    if (dto.assigneeResourceId) {
      qb.andWhere('v.assignee_resource_id = :assigneeResourceId', {
        assigneeResourceId: dto.assigneeResourceId,
      });
    }

    if (dto.statusBases?.length) {
      qb.andWhere('v.status_base IN (:...statusBases)', {
        statusBases: dto.statusBases,
      });
    }

    qb.orderBy('v.created_at', 'DESC');

    if (dto.limit) {
      qb.limit(dto.limit);
    }

    return qb.getMany();
  }

  // ── Resource Analytics ───────────────────────────────────────────────────

  async getResourceDashboard(
    dto: ResourceAnalyticsQueryDto,
  ): Promise<VwResourceDashboard[]> {
    return this.resourceDashboardRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId })
      .orderBy('v.utilization_pct', 'DESC')
      .getMany();
  }

  async getResourceSkillGap(
    dto: ResourceAnalyticsQueryDto,
  ): Promise<VwResourceSkillGap[]> {
    return this.resourceSkillGapRepo
      .createQueryBuilder('v')
      .where('v.company_id = :companyId', { companyId: dto.companyId })
      .orderBy('v.gap_count', 'DESC')
      .getMany();
  }
}