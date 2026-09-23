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
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { CommentService } from './comment.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { uploadAttachmentToAzure } from '../../common/azure/azure-image-upload';

@Controller('comment')
export class CommentController {
  constructor(
    private readonly service: CommentService,
    private commonService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload-attachment')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const userId = req.user?.id || 0;
      const fileUrl = await uploadAttachmentToAzure(file, userId);
      return { url: fileUrl };
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw new HttpException(
        'Failed to upload attachment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonService.search('comment', item);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Post()
  @UseInterceptors(FileInterceptor('files'))
  async create(
    @Body() createDto: CreateCommentDto,
    @UploadedFile() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    return this.service.create(createDto, files, req.user);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55', '56', '103', '104')
  @Put(':id')
  @UseInterceptors(FileInterceptor('files'))
  async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateCommentDto,
    @UploadedFile() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    return this.service.update(id, updateDto, files, req.user);
  }

  // Specific routes MUST come before generic :id route
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get('post/:postId')
  findByPost(
    @Param('postId') postId: number,
    @Query('postType') postType: string,
  ) {
    return this.service.findByPost(postId, postType);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get('parent/:parentId')
  findByParent(@Param('parentId') parentId: number) {
    return this.service.findByParent(parentId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Generic :id route MUST be last
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
