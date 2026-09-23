import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PulseModule } from '../pulse/pulse.module';
import { MeetingsIntegrationModule } from '../meetings-integration/meetings-integration.module';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [RedisModule, PulseModule, MeetingsIntegrationModule],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
