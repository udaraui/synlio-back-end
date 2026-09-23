import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { CommonModule } from '../../common/common.module';
import { AuthorizationModule } from '../../authorization/authorization.module';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService, CommonDbOperationService],
  imports: [AuthorizationModule, CommonModule],
})
export class CalendarModule {}
