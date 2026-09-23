import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { TicketAttachmentService } from './ticket-attachment.service';
import {
  CreateTicketAttachmentDto,
  UpdateTicketAttachmentDto,
} from './dto/ticket-attachment.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadTaskAttachmentToAzure } from '../../common/azure/azure-image-upload';

@Controller('ticket-attachment')
export class TicketAttachmentController {
  constructor(
    private readonly service: TicketAttachmentService,
    private commonService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('101')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonService.search('ticket-attachment', item);
  }

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
      const fileUrl = await uploadTaskAttachmentToAzure(file, userId);
      return { url: fileUrl };
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw new HttpException(
        'Failed to upload attachment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @AuthorizationPermissions('103')
  create(@Body() createDto: CreateTicketAttachmentDto, @Request() req: any) {
    return this.service.create(createDto, req.user);
  }

  /**
   * PATCH /ticket-attachment/upload/:ticketId
   * Uploads a file to Azure and immediately creates the attachment record.
   * Used for auto-save when a file is selected in the UI.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('upload/:ticketId')
  @UseInterceptors(FileInterceptor('file'))
  async patchUploadAttachment(
    @Param('ticketId') ticketId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    try {
      const userId = req.user?.id || 0;
      const fileUrl = await uploadTaskAttachmentToAzure(file, userId);
      return this.service.create(
        { ticketId: Number(ticketId), link: fileUrl },
        req.user,
      );
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw new HttpException(
        'Failed to upload attachment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('104')
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() updateDto: UpdateTicketAttachmentDto,
    @Request() req: any,
  ) {
    return this.service.update(id, updateDto, req.user);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('101')
  @Get('ticket/:ticketId')
  findByTicket(@Param('ticketId') ticketId: number) {
    return this.service.findByTicket(ticketId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('101')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('101')
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('102')
  @Delete(':id')
  delete(@Param('id') id: number, @Request() req: any) {
    return this.service.delete(id, req.user);
  }
}
