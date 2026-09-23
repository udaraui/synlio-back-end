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
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { CommentAttachmentService } from './comment-attachment.service';
import {
  CreateCommentAttachmentDto,
  UpdateCommentAttachmentDto,
} from './dto/comment-attachment.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';

@Controller('comment-attachment')
export class CommentAttachmentController {
  constructor(
    private service: CommentAttachmentService,
    private commonService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonService.search('comment_attachment', item);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Post()
  create(@Body() createDto: CreateCommentAttachmentDto, @Request() req: any) {
    return this.service.create(createDto, req.user);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() updateDto: UpdateCommentAttachmentDto,
    @Request() req: any,
  ) {
    return this.service.update(id, updateDto, req.user);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get('comment/:commentId')
  findByComment(@Param('commentId') commentId: number) {
    return this.service.findByComment(commentId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Delete(':id')
  delete(@Param('id') id: number, @Request() req: any) {
    return this.service.delete(id, req.user);
  }
}
