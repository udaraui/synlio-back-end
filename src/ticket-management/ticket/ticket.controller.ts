import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import {
  CreateTicketDto,
  ResponseTicketDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';

import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';

@Controller('ticket')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('101')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Request() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;

    if (activeCompanyId && activeCompanyId !== 0) {
      if (!item.filters) item.filters = [];
      item.filters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    // const codeSort = item.multiSorts?.find((ms) => ms.field === 'code');
    // if (codeSort) {
    //   return this.handleTicketCodeSort(item, codeSort, undefined, activeCompanyId);
    // }

    return this.commonDbOperationService.search('ticket', {
      ...item,
      // withRelations: ['status', 'severity', 'assignee', 'queue', 'ticketType'],
    });
  }

  @AuthorizationPermissions('101')
  @Post('/search-by-queue')
  async searchByQueue(
    @Body() item: QueryParam,
    @Request() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const userId = req.user.userId as number;
    const activeCompanyId = req.activeCompany?.companyId;

    // const codeSort = item.multiSorts?.find((ms) => ms.field === 'code');
    // if (codeSort) {
    //   return this.handleTicketCodeSort(item, codeSort, userId, activeCompanyId);
    // }

    return this.ticketService.searchByQueue(userId, item, activeCompanyId);
  }

  @AuthorizationPermissions('101')
  @Post('/bulk-relations')
  getBulkTicketRelations(
    @Body('ticketIds') ticketIds: number[],
    @Request() req: any,
  ): Promise<any> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.getBulkTicketRelations(
      ticketIds,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('101')
  @Post('/status-counts')
  getTicketStatusCounts(
    @Body('ticketSpaceId') ticketSpaceId: number,
    @Request() req: any,
  ): Promise<any> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.getTicketStatusCounts(
      ticketSpaceId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('101')
  @Post('/bulk-status-counts')
  getBulkTicketStatusCounts(
    @Body('spaceIds') spaceIds: number[],
    @Request() req: any,
  ): Promise<any> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.getBulkTicketStatusCounts(
      spaceIds,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('101')
  @Get()
  findAll(@Request() req: any): Promise<ResponseTicketDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.findAll(activeCompanyId) as Promise<
      ResponseTicketDto[]
    >;
  }

  @AuthorizationPermissions('101')
  @Get('next-code/:ticketSpaceId')
  getNextTicketCode(
    @Param('ticketSpaceId') ticketSpaceId: number,
    @Request() req: any,
  ): Promise<{ code: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.getNextTicketCodeById(
      ticketSpaceId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('101')
  @Get(':id/core')
  findBase(@Param('id') id: number, @Request() req: any): Promise<any> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.findBase(id, activeCompanyId);
  }

  @AuthorizationPermissions('101')
  @Get(':id/assignees')
  findAssignees(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ assignee: any; participants: any[] }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.findAssignees(id, activeCompanyId);
  }

  @AuthorizationPermissions('101')
  @Get(':id/events')
  findEvents(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ ticketEvents: any[] }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.findEvents(id, activeCompanyId);
  }

  @AuthorizationPermissions('101')
  @Get(':id')
  findOne(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<ResponseTicketDto> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.findOne(id, activeCompanyId);
  }

  @AuthorizationPermissions('103')
  @Post()
  create(@Body() createTicketDto: CreateTicketDto, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.create(
      createTicketDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Put(':id')
  updateTicket(
    @Param('id') id: number,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicket(
      id,
      updateTicketDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/name')
  updateTicketName(
    @Param('id') id: number,
    @Body() body: { name: string; oldName?: string | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketName(
      id,
      body.name,
      body.oldName ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/status')
  updateTicketStatus(
    @Param('id') id: number,
    @Body() body: { statusId: number; oldStatusId?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketStatus(
      id,
      body.statusId,
      body.oldStatusId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/severity')
  updateTicketSeverity(
    @Param('id') id: number,
    @Body() body: { severityId: number; oldSeverityId?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketSeverity(
      id,
      body.severityId,
      body.oldSeverityId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/queue')
  updateTicketQueue(
    @Param('id') id: number,
    @Body() body: { queueId: number | null; oldQueueId?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketQueue(
      id,
      body.queueId,
      body.oldQueueId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/impact')
  updateTicketImpact(
    @Param('id') id: number,
    @Body() body: { impactId: number | null; oldImpactId?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketImpact(
      id,
      body.impactId,
      body.oldImpactId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/type')
  updateTicketType(
    @Param('id') id: number,
    @Body('ticketTypeId') ticketTypeId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketType(
      id,
      ticketTypeId,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/assignee')
  updateTicketAssignee(
    @Param('id') id: number,
    @Body() body: { assigneeId: number | null; oldAssigneeId?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketAssignee(
      id,
      body.assigneeId,
      body.oldAssigneeId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/participants')
  updateTicketParticipants(
    @Param('id') id: number,
    @Body('participantIds') participantIds: number[],
    @Body('participants') participants: any[],
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketParticipants(
      id,
      participantIds,
      req.user,
      activeCompanyId,
      participants,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/description')
  updateTicketDescription(
    @Param('id') id: number,
    @Body('description') description: string | null,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketDescription(
      id,
      description ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/effort')
  updateTicketEffort(
    @Param('id') id: number,
    @Body() body: { plannedEffort: number | null; actualEffort: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketEffort(
      id,
      body.plannedEffort ?? null,
      body.actualEffort ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('104')
  @Patch(':id/completion-date')
  updateTicketCompletionDate(
    @Param('id') id: number,
    @Body('completionDate') completionDate: string | null,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.patchTicketCompletionDate(
      id,
      completionDate ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('102')
  @Delete(':id')
  delete(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.delete(id, req.user, activeCompanyId);
  }
}
