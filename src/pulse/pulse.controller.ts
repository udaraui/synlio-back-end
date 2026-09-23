import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PulseService } from './pulse.service';
import { AuthorizationPermissions } from '../authorization/decorator/authorization-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';
import { UpdatePulseDto } from './dto/pulse.dto';
import {
  CreatePulseWeekDto,
  SubmitPulseWeekDto,
  ForwardPulseWeekDto,
  ApprovePulseWeekDto,
  RejectPulseWeekDto,
} from './dto/pulse-week.dto';
import { QueryParam } from '../common/common-db-operation/common-db-operation-query-param.dto';
import { CommonDbOperationService } from '../common/common-db-operation/common-db-operation.service';
import {
  CreateNewActivityDto,
  LinkTaskToActivityDto,
} from './dto/new-activity.dto';

@Controller('pulse')
export class PulseController {
  constructor(
    private readonly pulseService: PulseService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/needs-attention')
  getNeedsAttentionData(@Request() req: any): Promise<any> {
    return this.pulseService.getNeedsAttentionData(
      req.user?.email,
      req.activeCompany?.companyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/synlio-activity')
  getSynlioActivityData(
    @Request() req: any,
    @Query() query: { startDate?: string; endDate?: string },
  ): Promise<any> {
    return this.pulseService.getSynlioActivityData(
      req.user?.email,
      req.activeCompany?.companyId,
      query.startDate,
      query.endDate,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/logged-user-working-hours')
  getLoggedUserWorkingHoursPerWeek(@Request() req: any): Promise<number> {
    return this.pulseService.getLoggedUserWorkingHoursPerWeek(
      req.user?.email,
      req.activeCompany?.companyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/get-my-submisson-status')
  getMyStatus(@Request() req: any): Promise<any> {
    return this.pulseService.getMyStatus(
      req.user?.email,
      req.activeCompany?.companyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/item-status-config/:postType/:spaceId/:postId')
  getItemStatusConfig(
    @Param('postType') postType: string,
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: any,
  ): Promise<{ statuses: any[]; currentStatusId: number | null }> {
    return this.pulseService.getItemStatusConfig(
      postType,
      spaceId,
      postId,
      req.activeCompany?.companyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/item-progress/:postType/:postId')
  getItemProgress(
    @Param('postType') postType: string,
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<{ progressPercentage: number | null }> {
    return this.pulseService.getItemProgress(postType, postId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/item-dates/:postType/:postId')
  getItemDates(
    @Param('postType') postType: string,
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<{ startDate: Date | null; dueDate: Date | null }> {
    return this.pulseService.getItemDates(postType, postId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Post('/week/search')
  searchPulseWeeks(
    @Body() queryParam: QueryParam,
    @Request() req: any,
  ): Promise<any> {
    const companyId = req.activeCompany?.companyId;
    const userEmail = req.user?.email;
    return this.pulseService.searchPulse(queryParam, companyId, userEmail);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Post('/week/to-approve')
  getPulseWeekToApprove(
    @Body()
    body: {
      weekId: number;
      companyId: number;
      submittedToEmail: string;
    },
  ): Promise<any> {
    return this.pulseService.getPulseWeekToApprove(
      body.weekId,
      body.companyId,
      body.submittedToEmail,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/week/:id/pulses')
  getPulseWeekPulses(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<any> {
    const companyId = req.activeCompany?.companyId;
    return this.pulseService.getPulseWeekPulses(id, companyId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Post('/snapshot')
  createPulseWeek(
    @Body() createPulseWeekDto: CreatePulseWeekDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.createPulseWeek(
      createPulseWeekDto,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Put(':id')
  updateSnapShot(
    @Param('id') id: number,
    @Body() updatePulseDto: UpdatePulseDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.updateSnapShot(
      id,
      updatePulseDto,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('hierarchy/:postType/:postId')
  getPostHierarchy(
    @Param('postId') postId: number,
    @Param('postType') postType: string,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.getPostHierarchy(
      postId,
      postType,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/week/:id/submit')
  submitPulseWeek(
    @Param('id') id: number,
    @Body() submitPulseWeekDto: SubmitPulseWeekDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.submitPulseWeek(
      id,
      submitPulseWeekDto,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/week/:id/sync-pulse')
  syncPulseRecord(
    @Param('id') id: number,
    @Body() createPulseDto: any,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.syncPulseRecord(
      id,
      createPulseDto,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/week/:weekId/pulse/:pulseId/log-time')
  logTimeOnPulse(
    @Param('weekId', ParseIntPipe) weekId: number,
    @Param('pulseId', ParseIntPipe) pulseId: number,
    @Body() logTimeDto: { hours: number; startDate?: string; endDate?: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.logTimeOnPulse(
      weekId,
      pulseId,
      logTimeDto.hours,
      logTimeDto.startDate,
      logTimeDto.endDate,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/week/:id/forward')
  forwardPulseWeek(
    @Param('id') id: number,
    @Body() forwardPulseWeekDto: ForwardPulseWeekDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.forwardPulseWeek(
      id,
      forwardPulseWeekDto,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/week/:id/approve')
  approvePulseWeek(
    @Param('id') id: number,
    @Body() approvePulseWeekDto: ApprovePulseWeekDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.approvePulseWeek(
      id,
      approvePulseWeekDto,
      req.user,
      activeCompanyId,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/week/:id/reject')
  rejectPulseWeek(
    @Param('id') id: number,
    @Body() rejectPulseWeekDto: RejectPulseWeekDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.pulseService.rejectPulseWeek(
      id,
      rejectPulseWeekDto,
      req.user,
      activeCompanyId,
    );
  }

  // ─── New Activity Endpoints ───────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Post('/new-activity')
  async createNewActivity(
    @Body() dto: CreateNewActivityDto,
    @Request() req: any,
  ) {
    try {
      const userId: number = req.user?.userId ?? req.user?.id;
      const companyId: number = req.activeCompany?.companyId;
      return await this.pulseService.createNewActivity(
        userId,
        companyId,
        dto,
        req.user?.email,
      );
    } catch (e) {
      console.error('CREATE_NEW_ACTIVITY_ERROR:', e);
      throw e;
    }
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Get('/new-activity')
  getNewActivities(
    @Request() req: any,
    @Query() query: { startDate?: string; endDate?: string },
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    const companyId: number = req.activeCompany?.companyId;
    return this.pulseService.getNewActivities(
      userId,
      companyId,
      query.startDate,
      query.endDate,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/new-activity/:id/link-task')
  linkTaskToActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkTaskToActivityDto,
    @Request() req: any,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    const companyId: number = req.activeCompany?.companyId;
    return this.pulseService.linkTaskToActivity(
      id,
      userId,
      companyId,
      dto,
      req.user?.email,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Patch('/new-activity/:id/unlink-task')
  unlinkTaskFromActivity(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    const companyId: number = req.activeCompany?.companyId;
    return this.pulseService.unlinkTaskFromActivity(
      id,
      userId,
      companyId,
      req.user?.email,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54', '101', '109')
  @Delete('/new-activity/:id')
  deleteNewActivity(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    const companyId: number = req.activeCompany?.companyId;
    return this.pulseService.deleteNewActivity(id, userId, companyId);
  }
}
