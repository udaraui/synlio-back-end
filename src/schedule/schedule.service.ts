import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EntityManager } from 'typeorm';
import { UserPrivilegeView } from 'src/user-management/user/user-privilege-view/user-privilege.entity';
import { UserCompanyView } from '../user-management/user/user-company-view/user-company.entity';
import { Cron } from '@nestjs/schedule';
import { PulseService } from '../pulse/pulse.service';
import { Resource } from '../resource-management/resource/resource.entity';
import { Company } from '../company-management/company/company.entity';
import { PulseWeek } from '../pulse/pulse-week.entity';
import { PulseSnapshotStatus } from '../common/enum/pulse-snapshot-status.enum';
import { PulseType } from '../common/enum/pulse-type.enum';
import { AssigneeType } from '../common/enum/assignee-type.enum';
import { CreatePulseWeekDto } from '../pulse/dto/pulse-week.dto';
import { CreatePulseDto } from '../pulse/dto/pulse.dto';
import { MeetingsIntegrationService } from '../meetings-integration/meetings-integration.service';
import { Calendar } from '../resource-management/calendar/calendar.entity';
import { CalendarDays } from '../resource-management/calendar/calendar-days.entity';
import { User } from '../user-management/user/user.entity';

@Injectable()
export class ScheduleService {
  private cached = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly entityManager: EntityManager,
    private readonly pulseService: PulseService,
    private readonly meetingsService: MeetingsIntegrationService,
  ) { }

  async onModuleInit() {
    if (!this.cached) {
      try {
        await this.cachePrivileges();
        await this.cacheUserCompanies();
        this.cached = true; // ensure it won't run again
      } catch (error) {
        // If the view doesn't exist yet (e.g., migrations not run), log and skip caching
        if (error.code === '42P01') {
          // PostgreSQL error code for "relation does not exist"
          console.warn(
            'Warning: user_privilege_view or user_company_view does not exist yet. Skipping caching. Please run migrations.',
          );
        } else {
          console.error('Error caching data:', error);
        }
      }
    }
    // await this.handleDailyPulseWeekDrafts();
  }

  private async cachePrivileges() {
    const privileges = await this.entityManager.find(UserPrivilegeView);

    // Group by userId → companyId → privilegeIds[]
    const userMap = new Map<number, Map<number, number[]>>();

    for (const record of privileges) {
      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, new Map());
      }
      const companyMap = userMap.get(record.userId)!;
      if (!companyMap.has(record.companyId)) {
        companyMap.set(record.companyId, []);
      }
      companyMap.get(record.companyId)!.push(record.privilegeId);
    }

    // Store per user as JSON: [{companyId, privilegeIds:[...]}, ...]
    for (const [userId, companyMap] of userMap) {
      const payload = Array.from(companyMap.entries()).map(
        ([companyId, privilegeIds]) => ({ companyId, privilegeIds }),
      );
      await this.redisService.set(`user_privileges:${userId}`, JSON.stringify(payload));
    }
  }

  private async cacheUserCompanies() {
    try {
      const userCompanies = await this.entityManager.find(UserCompanyView);

      const userCompanyMap = new Map<number, UserCompanyView[]>();

      for (const record of userCompanies) {
        if (!userCompanyMap.has(record.userId)) {
          userCompanyMap.set(record.userId, []);
        }
        userCompanyMap.get(record.userId)!.push(record);
      }

      for (const [userId, companies] of userCompanyMap) {
        await this.redisService.setUserCompanies(userId, companies);
      }
    } catch (error) {
      if (error.code === '42P01') {
        console.warn('Warning: user_company_view does not exist yet.');
      } else {
        console.error('Error caching user companies:', error);
      }
    }
  }

  @Cron('55 23 * * *')
  async handleDailyPulseWeekDrafts() {
    if (process.env.NODE_ENV === 'development') {
      console.log('SKIPPING - Pulse Snapshot Drafting in development environment.');
      return;
    }
    await this.generateDraftsForDate(new Date());
  }

  async generateDraftsForDate(currentDate: Date | string) {
    // dynamic week end date for draft
    const d = currentDate as Date;
    const currentDateStr = typeof currentDate === 'string' 
      ? currentDate 
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    try {
      console.log(`Started Pulse Week Drafts creating for ${currentDateStr}...`);

      const { entities: usersWithoutPulse, raw } = await this.entityManager
        .createQueryBuilder(Resource, 'resource')
        .leftJoinAndSelect('resource.company', 'company')
        // Join Resource's Calendar or fallback to Company's active Calendar
        .leftJoin(
          Calendar,
          'cal',
          'cal.id = COALESCE(resource."calendarId", (SELECT c.id FROM calendar c WHERE c."companyId" = resource."companyId" AND c."isActive" = true LIMIT 1))'
        )
        // Join CalendarDays to check if today is week end date
        .innerJoin(
          CalendarDays,
          'cd',
          'cd."calendarId" = cal.id AND cd.date = :currentDateStr AND cd.date = cd."weekEndDate"',
          { currentDateStr }
        )
        // Check if pulse already exists for this weekEndDate
        .leftJoin(
          PulseWeek,
          'pulseWeek',
          '"pulseWeek"."userId" = resource."userId" AND "pulseWeek"."companyId" = resource."companyId" AND "pulseWeek"."weekEndDate" = cd."weekEndDate"'
        )
        .where('pulseWeek.id IS NULL')
        .addSelect(`TO_CHAR(cd."weekStartDate", 'YYYY-MM-DD')`, 'weekStartDateStr')
        .addSelect(`TO_CHAR(cd."weekEndDate", 'YYYY-MM-DD')`, 'weekEndDateStr')
        .addSelect('cd.weekStartDate', 'weekStartDate')
        .addSelect('cd.weekEndDate', 'weekEndDate')
        .getRawAndEntities();

      if (usersWithoutPulse.length === 0) {
        console.log(`Skipping generateDraftsForDate: No users found whose week ends on ${currentDateStr}.`);
        return;
      } else {
        console.log(`Found ${usersWithoutPulse.length} users whose week ends on ${currentDateStr}. Continuing with Pulse Week Drafts...`);
      }

      const CHUNK_SIZE = 20;
      for (let i = 0; i < usersWithoutPulse.length; i += CHUNK_SIZE) {
        const chunk = usersWithoutPulse.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (resource, idx) => {
          const rawRow = raw[i + idx];
          const dynamicStartDate = new Date(rawRow.weekStartDate);
          const weekEndDate = new Date(rawRow.weekEndDate);
          const weekEndDateStr = rawRow.weekEndDateStr;
          const startDateStr = rawRow.weekStartDateStr;
          if (!resource.companyId) return;

          const userEmail = resource.email;
          let userId = resource.userId;
          const companyId = resource.companyId;

          if (!userId && userEmail) {
            const userRec = await this.entityManager.findOne(User, { where: { email: userEmail } });
            if (userRec && userRec.id) {
              userId = userRec.id as number;
            } else {
              console.log(`Skipping draft creation for ${userEmail} (Company ID: ${companyId}): No User found for this email.`);
              return;
            }
          }

          if (!userId) return;

          // Dynamic Start Date Logic
          const lastRecord = await this.entityManager.findOne(PulseWeek, {
            where: { userId: userId as number, companyId: companyId },
            order: { weekEndDate: 'DESC' },
          });

          if (lastRecord && lastRecord.weekEndDate) {
            // Check if the latest record's week end date is >= our target week end date
            // This prevents generating duplicate drafts if they already have a record for this or a future period.
            if (lastRecord.weekEndDate >= new Date(weekEndDateStr)) {
              console.log(`Skipping draft creation for ${userEmail}: already has a snapshot for week ending ${lastRecord.weekEndDate}`);
              return;
            }
          }

          // 1. Load Data in Parallel
          const [needsAttentionData, synlioActivity, meetingStats, meetingsResponse] = await Promise.all([
            this.pulseService.getNeedsAttentionData(userEmail, String(companyId), startDateStr).catch(e => { console.error(e); return []; }),
            this.pulseService.getSynlioActivityData(userEmail, String(companyId), startDateStr, weekEndDateStr).catch(e => { console.error(e); return []; }),
            this.meetingsService.getMeetingStats(userId as number, startDateStr, weekEndDateStr).catch(e => { console.error(`Error fetching meeting stats for user ${userId}:`, e); return null; }),
            this.meetingsService.getMeetings(userId as number, { startDate: startDateStr, endDate: weekEndDateStr }).catch(e => { console.error(`Error fetching meetings for user ${userId}:`, e); return { data: [] }; })
          ]);

          // 3. Calculate Working Hours
          const loggedUserWorkingHoursPerWeek = resource.working_hours ? resource.working_hours * 5 : 40;

          // 4. Map Data
          const activityDataPayload: CreatePulseDto[] = synlioActivity?.map((item: any) => ({
            pulseType: PulseType.SYNLIO_ACTIVITY,
            postType: item.postType === 'Activity' ? null : item.postType,
            postId: item.id,
            postCode: item.code,
            postName: item.name,
            postSpaceId: item.spaceId,
            postSpaceName: item.space,
            resourceType: item.userRole === 'SBASS' ? AssigneeType.SBASS : (item.userRole === 'ASS' ? AssigneeType.ASS : item.userRole),
            pulseSummary: item.change ? JSON.stringify({ ...item.change, _changeOccurredAt: item.changeOccurredAt }) : undefined,
            pulseSnapshotStatus: PulseSnapshotStatus.DRAFT,
            allocatedHours: parseFloat(item.totalEffortInRange || '0'),
            submittedAt: new Date(),
          })) || [];

          let meetingTime = meetingStats?.totalHours || 0;
          const meetingsData = meetingsResponse?.data || [];

          let meetingDataPayload: CreatePulseDto[] = meetingsData.map((item: any) => ({
            companyId: companyId,
            pulseType: PulseType.MEETING_TIME,
            // postId: item.id,
            postCode: item.provider,
            postName: item.title,
            postSpaceId: 0,
            postSpaceName: 'Meetings',
            resourceType: AssigneeType.ASS,
            pulseSummary: JSON.stringify({ durationMinutes: item.effectiveDurationMinutes || item.durationMinutes, provider: item.provider }),
            pulseSnapshotStatus: PulseSnapshotStatus.DRAFT,
            allocatedHours: (item.effectiveDurationMinutes || item.durationMinutes || 0) / 60,
            submittedAt: new Date(),
          }));

          let taskFromMeetingCount = meetingsData.filter(
            (m: any) => m.actionState === 'linked_to_task' || m.linkedTaskId != null
          ).length;

          const mappedPulses = [...activityDataPayload, ...meetingDataPayload];

          // 5. Calculations
          const uniqueActivities = Array.from(new Map((synlioActivity || []).map((item: any) => [`${item.id}-${item.postType}`, item])).values());
          const synlioActivityTime: number = uniqueActivities.reduce((acc: number, item: any) => acc + parseFloat(item.totalEffortInRange || '0'), 0) as number;

          const uniqueNeedsAttention = Array.from(new Map((needsAttentionData || []).map((item: any) => [`${item.id}-${item.postType}`, item])).values());
          const needAttentionCount = uniqueNeedsAttention.length;

          const totalTrackedTime = synlioActivityTime + meetingTime;
          const missingTime = loggedUserWorkingHoursPerWeek - totalTrackedTime;

          // 6. Construct DTO
          const dto: CreatePulseWeekDto = {
            weekStartDate: startDateStr as any,
            weekEndDate: weekEndDateStr as any,
            status: PulseSnapshotStatus.DRAFT,
            userId: userId as number,
            userEmail: userEmail,
            userFullName: `${resource.first_name} ${resource.last_name}`,
            userProfilePicture: resource.profile_pic,
            needAttentionCount: needAttentionCount,
            synlioActivityTime: synlioActivityTime,
            meetingTime: meetingTime,
            taskFromMeetingCount: taskFromMeetingCount,
            missingTime: missingTime,
            pulses: mappedPulses,
          };

          console.log(`Saving snapshot draft for user: ${userEmail} (Company ID: ${companyId}) for week ending ${weekEndDateStr}...`);
          await this.pulseService.createPulseWeek(
            dto,
            {
              userId: userId as number,
              email: userEmail,
              username: `${resource.first_name} ${resource.last_name}`
            },
            companyId,
            true,
          );
        }));
      }
      console.log(`Finished Daily Pulse Week Drafts creating for ${currentDateStr}.`);
    } catch (error) {
      console.error(`Error executing Pulse Week Drafts cron for ${currentDateStr}:`, error);
    }
  }
}
