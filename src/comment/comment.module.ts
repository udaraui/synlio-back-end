import { Module } from '@nestjs/common';
import { CommentController } from './comment/comment.controller';
import { CommentService } from './comment/comment.service';
import { CommentAttachmentController } from './comment-attachment/comment-attachment.controller';
import { CommentAttachmentService } from './comment-attachment/comment-attachment.service';
import { CommonDbOperationService } from '../common/common-db-operation/common-db-operation.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TicketManagementModule } from '../ticket-management/ticket-management.module';
import { TaskManagementModule } from '../task-management/task-management.module';

@Module({
  imports: [AuthorizationModule, TicketManagementModule, TaskManagementModule],
  controllers: [CommentController, CommentAttachmentController],
  providers: [
    CommentService,
    CommentAttachmentService,
    CommonDbOperationService,
  ],
})
export class CommentModule {}
