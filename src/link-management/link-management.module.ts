import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RedisModule } from '../redis/redis.module';
import { LinkTypeController } from './link-type/link-type.controller';
import { LinkTypeService } from './link-type/link-type.service';
import { WorkItemLinkController } from './work-item-link/work-item-link.controller';
import { WorkItemLinkService } from './work-item-link/work-item-link.service';

@Module({
  imports: [CommonModule, AuthorizationModule, RedisModule],
  controllers: [LinkTypeController, WorkItemLinkController],
  providers: [LinkTypeService, WorkItemLinkService],
  exports: [LinkTypeService, WorkItemLinkService],
})
export class LinkManagementModule {}
