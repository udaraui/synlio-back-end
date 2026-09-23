import { Module } from '@nestjs/common';
import { DivisionController } from './division.controller';
import { DivisionService } from './division.service';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { CommonModule } from '../../common/common.module';

@Module({
  controllers: [DivisionController],
  providers: [DivisionService, CommonDbOperationService],
  imports: [AuthorizationModule, CommonModule],
})
export class DivisionModule {}
