import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingIntegrationConnection, ConnectionStatus } from './entities/meeting-integration-connection.entity';
import { MeetingsIntegrationService } from './meetings-integration.service';

/**
 * Runs a background sync of all users' meeting connections once per day at 6:00 AM.
 * Respects the admin consent gate inside MeetingsIntegrationService.syncMeetings().
 */
@Injectable()
export class MeetingsSyncScheduler {
  private readonly logger = new Logger(MeetingsSyncScheduler.name);

  constructor(
    @InjectRepository(MeetingIntegrationConnection)
    private readonly connectionRepo: Repository<MeetingIntegrationConnection>,
    private readonly meetingsService: MeetingsIntegrationService,
  ) {}

  /**
   * Daily auto-sync at 6:00 AM server time.
   * Iterates every user that has at least one CONNECTED meeting integration and triggers a full sync.
   */
  @Cron('0 6 * * *', { name: 'daily-meetings-sync' })
  async handleDailySync() {
    this.logger.log('[DailySync] Starting daily meetings sync...');

    try {
      // Collect distinct user IDs that have at least one connected integration
      const connections = await this.connectionRepo.find({
        where: { status: ConnectionStatus.CONNECTED },
        select: ['userId'],
      });

      const uniqueUserIds = [...new Set(connections.map((c) => c.userId))];

      if (!uniqueUserIds.length) {
        this.logger.log('[DailySync] No connected users found, skipping.');
        return;
      }

      this.logger.log(`[DailySync] Syncing meetings for ${uniqueUserIds.length} user(s)...`);

      let totalSynced = 0;
      let successCount = 0;
      let failCount = 0;

      for (const userId of uniqueUserIds) {
        try {
          const results = await this.meetingsService.syncMeetings(userId, undefined, undefined, undefined, 'system');
          const synced = results.reduce((acc, r) => acc + r.synced, 0);
          totalSynced += synced;
          successCount++;
          this.logger.log(`[DailySync] User ${userId}: ${synced} meeting(s) synced`);
        } catch (err) {
          failCount++;
          this.logger.error(`[DailySync] Failed for user ${userId}: ${err?.message}`);
        }
      }

      this.logger.log(
        `[DailySync] Complete — ${totalSynced} total meetings synced, ${successCount} users OK, ${failCount} failed.`,
      );
    } catch (err) {
      this.logger.error(`[DailySync] Unexpected error during daily sync: ${err?.message}`, err?.stack);
    }
  }
}
