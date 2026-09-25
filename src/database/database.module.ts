import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../user-management/user/user.entity';
import { Role } from '../user-management/role/role.entity';
import { Privilege } from '../user-management/privilege/privilege.entity';
import { Company } from '../company-management/company/company.entity';
import { Division } from '../company-management/division/division.entity';
import { UserCompanyRole } from '../user-management/user/user-company-role.entity';
import { UserCompanyView } from '../user-management/user/user-company-view/user-company.entity';
import { UserCompanyPrivilegeView } from '../user-management/user/user-company-privilege-view/user-company-privilege.entity';
import { CompanyWiseUserView } from '../user-management/user/company-wise-user-view/companyWiseUser.entity';
import { SkillCategories } from '../resource-management/skill-management/skill-category/skill-category.entity';
import { Skill } from '../resource-management/skill-management/skill/skill.entity';
import { SkillLevel } from '../resource-management/skill-management/skill-level/skill-level.entity';
import { Calendar } from '../resource-management/calendar/calendar.entity';
import { CalendarDays } from '../resource-management/calendar/calendar-days.entity';
import { Resource } from '../resource-management/resource/resource.entity';
import { CompanyWiseResourceView } from '../resource-management/resource/company-wise-resource-view/companyWiseResource.entity';
import { ResourceSkill } from '../resource-management/resource/resource-skill.entity';
import { ResourcePool } from '../resource-management/resource-pool/resource-pool.entity';
import { CompanyWiseResourcePoolView } from '../resource-management/resource-pool/company-wise-resource-pool/companyWiseResourcePool.entity';
import { Comment } from '../comment/comment/comment.entity';
import { CommentAttachment } from '../comment/comment-attachment/comment-attachment.entity';
import { UserConfig } from '../user-management/user/user-config.entity';
import { TicketType } from '../ticket-management/ticket-type/ticket-type.entity';
import { TicketImpact } from '../ticket-management/ticket-impact/ticket-impact.entity';
import { TicketQueue } from '../ticket-management/ticket-queue/ticket-queue.entity';
import { TicketSpace } from '../ticket-management/ticket-space/ticket-space.entity';
import { TicketSpaceMember } from '../ticket-management/ticket-space-member/ticket-space-member.entity';
import { Ticket } from '../ticket-management/ticket/ticket.entity';
import { TicketAttachment } from '../ticket-management/ticket-attachment/ticket-attachment.entity';
import { Notification } from '../alert/notification/notification.entity';
import { Email } from '../alert/email/email.entity';
import { EmailAttachment } from '../alert/email/email-attachment/email-attachment.entity';
import { NotificationAttachment } from '../alert/notification/notification-attachment/notification-attachment.entity';
import { TaskSpace } from '../task-management/task-space/task-space.entity';
import { TaskSpaceHierarchyLevel } from '../task-management/task-space-hierarchy-level/task-space-hierarchy-level.entity';
import { TaskSpaceHierarchyLevelConfig } from '../task-management/task-space-hierarchy-level/task-space-hierarchy-level-config.entity';
import { TaskSpaceStatusConfig } from '../task-management/task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../task-management/task-space-severity-config/task-space-severity-config.entity';
import { TicketSpaceStatusConfig } from '../ticket-management/ticket-space-status-config/ticket-space-status-config.entity';
import { TicketSpaceSeverityConfig } from '../ticket-management/ticket-space-severity-config/ticket-space-severity-config.entity';
import { TicketSpaceTypeConfig } from '../ticket-management/ticket-space-type-config/ticket-space-type-config.entity';
import { Task as TmTask } from '../task-management/task/task.entity';
import { TaskAttachment as TmTaskAttachment } from '../task-management/task-attachment/task-attachment.entity';
import { Checklist } from '../common/checklist/checklist.entity';
import { TaskEvent as TmTaskEvent } from '../task-management/task-event/task-event.entity';
import { ResourceCost } from 'src/resource-management/resource/resource-cost.entity';
import { Currency } from 'src/resource-management/currency/currency.entity';
import { UserPrivilegeView } from 'src/user-management/user/user-privilege-view/user-privilege.entity';
import { TmTaskLabel } from '../task-management/task-label/task-label.entity';
import { TicketEvent } from '../ticket-management/ticket-event/ticket-event.entity';
import { Status } from '../common/status/status.entity';
import { Severity } from '../common/severity/severity.entity';
import { SpaceAlertRule } from '../alert/alert-rule/space-alert-rule.entity';
import { VwTicketDashboard } from '../synalytics/entities/vw-ticket-dashboard.entity';
import { VwTicketStatusKpi } from '../synalytics/entities/vw-ticket-status-kpi.entity';
import { VwTicketWorkload } from '../synalytics/entities/vw-ticket-workload.entity';
import { VwTicketRecentList } from '../synalytics/entities/vw-ticket-recent-list.entity';
import { VwProjectDashboard } from '../synalytics/entities/vw-project-dashboard.entity';
import { VwProjectTaskDetail } from '../synalytics/entities/vw-project-task-detail.entity';
import { VwResourceDashboard } from '../synalytics/entities/vw-resource-dashboard.entity';
import { VwResourceSkillGap } from '../synalytics/entities/vw-resource-skill-gap.entity';
import { Note } from '../notes/note.entity';
import { WorkLog } from '../work-log/work-log.entity';
import { VwTicketDailyActivity } from 'src/synalytics/entities/vw-ticket-daily-activity.entity';
import { MeetingIntegrationConnection } from '../meetings-integration/entities/meeting-integration-connection.entity';
import { Meeting } from '../meetings-integration/entities/meeting.entity';
import { MeetingAttendee } from '../meetings-integration/entities/meeting-attendee.entity';
import { MeetingSyncState } from '../meetings-integration/entities/meeting-sync-state.entity';
import { MeetingActionState } from '../meetings-integration/entities/meeting-action-state.entity';
import { Pulse } from '../pulse/pulse.entity';
import { PulseWeek } from '../pulse/pulse-week.entity';
import { PostSequence } from '../common/sequence/post-sequence.entity';
import { Activity } from '../pulse/entities/activity.entity';
import { LinkType } from '../link-management/link-type/link-type.entity';
import { WorkItemLink } from '../link-management/work-item-link/work-item-link.entity';
import { TicketTemplate } from 'src/ticket-management/ticket-template/ticket-template.entity';
import { FilterTemplate } from '../filter-template/filter-template.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: undefined,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('PG_DB_URL'),
        entities: [
          User,
          UserConfig,
          Role,
          Privilege,
          Company,
          Division,
          UserCompanyRole,
          UserCompanyView,
          UserPrivilegeView,
          UserCompanyPrivilegeView,
          CompanyWiseUserView,
          SkillCategories,
          Skill,
          SkillLevel,
          Calendar,
          CalendarDays,
          Resource,
          ResourceCost,
          Currency,
          CompanyWiseResourceView,
          ResourceSkill,
          ResourcePool,
          CompanyWiseResourcePoolView,
          Comment,
          CommentAttachment,
          Status,
          Severity,
          TicketType,
          TicketImpact,
          TicketQueue,
          TicketSpace,
          TicketSpaceMember,
          Ticket,
          TicketAttachment,
          TicketEvent,
          TicketTemplate,
          Notification,
          NotificationAttachment,
          Email,
          EmailAttachment,
          TaskSpace,
          TaskSpaceHierarchyLevel,
          TaskSpaceHierarchyLevelConfig,
          TaskSpaceStatusConfig,
          TaskSpaceSeverityConfig,
          TicketSpaceStatusConfig,
          TicketSpaceSeverityConfig,
          TicketSpaceTypeConfig,
          TmTask,
          TmTaskAttachment,
          Checklist,
          TmTaskEvent,
          TmTaskLabel,
          SpaceAlertRule,
          VwTicketDashboard,
          VwTicketStatusKpi,
          VwTicketWorkload,
          VwTicketRecentList,
          VwProjectDashboard,
          VwProjectTaskDetail,
          VwResourceSkillGap,
          VwResourceDashboard,
          VwTicketDailyActivity,
          Note,
          WorkLog,
          MeetingIntegrationConnection,
          Meeting,
          MeetingAttendee,
          MeetingSyncState,
          MeetingActionState,
          Pulse,
          PulseWeek,
          PostSequence,
          Activity,
          LinkType,
          WorkItemLink,
          FilterTemplate,
        ],
        ssl: configService.get('NODE_ENV') === 'production',
        synchronize: false,
        migrationsRun: configService.get('NODE_ENV') === 'production',
      }),
    }),
  ],
})
export class DatabaseModule { }
