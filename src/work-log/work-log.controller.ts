import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthorizationPermissions } from '../authorization/decorator/authorization-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';
import { CreateWorkLogDto, UpdateWorkLogDto } from './dto/work-log.dto';
import { WorkLogService } from './work-log.service';

@Controller('work-log')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class WorkLogController {
  constructor(private readonly workLogService: WorkLogService) {}

  @AuthorizationPermissions('56')
  @Post()
  createResourceLog(@Body() dto: CreateWorkLogDto, @Request() req: any) {    
    const activeCompanyId = req.activeCompany?.companyId;
    return this.workLogService.createResourceLog(
      dto,
      req.user.email,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('54')
  @Get('resource-task-log-history/:postId')
  getResourceLogHistory(@Param('postId') postId: string, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.workLogService.getResourceTaskLogHistory(
      activeCompanyId,
      +postId,
      req.user.email,
    );
  }

  @AuthorizationPermissions('101')
  @Get('resource-ticket-log-history/:postId')
  getResourceTicketLogHistory(
    @Param('postId') postId: string,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.workLogService.getResourceTicketLogHistory(
      activeCompanyId,
      +postId,
      req.user.email,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id')
  patchResourceLog(
    @Param('id') id: string,
    @Body() dto: UpdateWorkLogDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.workLogService.patchResourceLog(
      activeCompanyId,
      +id,
      dto,
      req.user.email,
    );
  }

  @AuthorizationPermissions('56')
  @Delete(':id')
  deleteResourceLog(@Param('id') id: string, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.workLogService.deleteResourceLog(
      activeCompanyId,
      +id,
      req.user.email,
    );
  }
}
