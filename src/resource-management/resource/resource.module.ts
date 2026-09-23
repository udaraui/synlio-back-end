import { Module } from '@nestjs/common';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { CommonModule } from '../../common/common.module';
import { AuthorizationModule } from '../../authorization/authorization.module';

@Module({
  controllers: [ResourceController],
  providers: [ResourceService, CommonDbOperationService],
  imports: [AuthorizationModule, CommonModule],
  exports: [ResourceService],
})
export class ResourceModule {}
