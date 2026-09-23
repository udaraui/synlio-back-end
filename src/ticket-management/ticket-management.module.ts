import { Module } from '@nestjs/common';
import { TicketAlertService } from './ticket-alert/ticket-alert.service';
import { TicketSpaceController } from './ticket-space/ticket-space.controller';
import { TicketSpaceService } from './ticket-space/ticket-space.service';
import { TicketTypeController } from './ticket-type/ticket-type.controller';
import { TicketTypeService } from './ticket-type/ticket-type.service';
import { TicketImpactController } from './ticket-impact/ticket-impact.controller';
import { TicketImpactService } from './ticket-impact/ticket-impact.service';

import { TicketQueueController } from './ticket-queue/ticket-queue.controller';
import { TicketQueueService } from './ticket-queue/ticket-queue.service';
import { CommonModule } from '../common/common.module';
import { CommonDbOperationService } from '../common/common-db-operation/common-db-operation.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TicketSpaceMemberController } from './ticket-space-member/ticket-space-member.controller';
import { TicketSpaceMemberService } from './ticket-space-member/ticket-space-member.service';
import { TicketController } from './ticket/ticket.controller';
import { TicketService } from './ticket/ticket.service';
import { TicketAttachmentController } from './ticket-attachment/ticket-attachment.controller';
import { TicketAttachmentService } from './ticket-attachment/ticket-attachment.service';
import { TicketChecklistController } from './ticket-checklist/ticket-checklist.controller';
import { ChecklistService } from '../common/checklist/checklist.service';
import { AlertModule } from '../alert/alert.module';
import { RedisModule } from '../redis/redis.module';
import { TicketTemplateController } from './ticket-template/ticket-template.controller';
import { TicketTemplateService } from './ticket-template/ticket-template.service';

@Module({
  imports: [CommonModule, AuthorizationModule, AlertModule, RedisModule],
  controllers: [
    TicketSpaceController,
    TicketTypeController,
    TicketImpactController,

    TicketQueueController,
    TicketSpaceMemberController,
    TicketController,
    TicketAttachmentController,
    TicketChecklistController,
    TicketTemplateController,
  ],
  providers: [
    CommonDbOperationService,
    TicketSpaceService,
    TicketTypeService,
    TicketImpactService,

    TicketQueueService,
    TicketSpaceMemberService,
    TicketService,
    TicketAttachmentService,
    TicketAlertService,
    ChecklistService,
    TicketTemplateService,
  ],
  exports: [TicketAlertService, TicketService],
})
export class TicketManagementModule {}
