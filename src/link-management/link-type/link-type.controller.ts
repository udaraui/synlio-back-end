import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LinkTypeService } from './link-type.service';
import { CreateLinkTypeDto, UpdateLinkTypeDto } from './dto/link-type.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { PostType } from '../../common/enum/post-type.enum';

@Controller('link-management/link-type')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class LinkTypeController {
  constructor(private readonly linkTypeService: LinkTypeService) {}

  // View: View Task (54) / View Ticket Space (100) / View Project Space (44) —
  // covers both the task/ticket detail dialog and the space-settings tab.
  @AuthorizationPermissions('54', '100', '44')
  @Get()
  getAllLinkTypes(@Query('postType') postType?: PostType) {
    return this.linkTypeService.getAllLinkTypes(postType);
  }

  // Create/Edit/Delete are all done from space settings, guarded by the
  // space-level edit permissions: Edit Project Space (46) / Edit Ticket Space (98).
  @AuthorizationPermissions('46', '98')
  @Post()
  createLinkType(@Body() dto: CreateLinkTypeDto, @Request() req: any) {
    return this.linkTypeService.createLinkType(dto, req.user);
  }

  @AuthorizationPermissions('46', '98')
  @Put(':id')
  updateLinkType(
    @Param('id') id: number,
    @Body() dto: UpdateLinkTypeDto,
    @Request() req: any,
  ) {
    return this.linkTypeService.updateLinkType(+id, dto, req.user);
  }

  @AuthorizationPermissions('46', '98')
  @Delete(':id')
  deleteLinkType(@Param('id') id: number) {
    return this.linkTypeService.deleteLinkType(+id);
  }
}
