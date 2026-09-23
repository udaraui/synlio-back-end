import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MeetingsIntegrationController } from './meetings-integration.controller';
import { MeetingsIntegrationService } from './meetings-integration.service';
import { MeetingsSyncScheduler } from './meetings-sync.scheduler';
import { MeetingIntegrationConnection } from './entities/meeting-integration-connection.entity';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { MeetingSyncState } from './entities/meeting-sync-state.entity';
import { MeetingActionState } from './entities/meeting-action-state.entity';
import { TeamsProvider } from './providers/teams.provider';
import { ZoomProvider } from './providers/zoom.provider';
import { GoogleMeetProvider } from './providers/google-meet.provider';
import { SlackProvider } from './providers/slack.provider';
import { AuthorizationModule } from 'src/authorization/authorization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeetingIntegrationConnection,
      Meeting,
      MeetingAttendee,
      MeetingSyncState,
      MeetingActionState,
    ]),
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
    ConfigModule,
    AuthorizationModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MeetingsIntegrationController],
  providers: [
    MeetingsIntegrationService,
    MeetingsSyncScheduler,
    TeamsProvider,
    ZoomProvider,
    GoogleMeetProvider,
    SlackProvider,
  ],
  exports: [MeetingsIntegrationService],
})
export class MeetingsIntegrationModule {}
