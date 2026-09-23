import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WorkItemLinkService } from './work-item-link.service';
import {
  CreateWorkItemLinkDto,
  UpdateWorkItemLinkDto,
} from './dto/work-item-link.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { PostType } from '../../common/enum/post-type.enum';

@Controller('link-management/work-item-link')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class WorkItemLinkController {
  constructor(private readonly workItemLinkService: WorkItemLinkService) { }

  // Check Access for opening link in new tab
  @AuthorizationPermissions('54', '101')
  @Get('check-access/:type/:id')
  checkAccess(
    @Param('type') type: PostType,
    @Param('id') id: number,
    @Request() req: any,
  ) {
    return this.workItemLinkService.checkAccess(type, +id, req.user);
  }

  // View Task (54) / View Ticket (101)
  @AuthorizationPermissions('54', '101')
  @Get(':type/:id')
  getLinksForItem(@Param('type') type: PostType, @Param('id') id: number) {
    return this.workItemLinkService.getLinksForItem(type, +id);
  }

  // Edit Task (56) / Edit Ticket (104)
  @AuthorizationPermissions('56', '104')
  @Post()
  createLink(@Body() dto: CreateWorkItemLinkDto, @Request() req: any) {
    return this.workItemLinkService.createLink(dto, req.user);
  }

  @AuthorizationPermissions('56', '104')
  @Put(':id')
  updateLink(
    @Param('id') id: number,
    @Body() dto: UpdateWorkItemLinkDto,
    @Request() req: any,
  ) {
    return this.workItemLinkService.updateLink(+id, dto, req.user);
  }

  @AuthorizationPermissions('56', '104')
  @Delete(':id')
  deleteLink(@Param('id') id: number) {
    return this.workItemLinkService.deleteLink(+id);
  }
}
