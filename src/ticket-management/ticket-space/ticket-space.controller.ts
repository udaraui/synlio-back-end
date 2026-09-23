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
import { TicketSpaceService } from './ticket-space.service';
import {
  CreateTicketSpaceDto,
  ResponseTicketSpaceDto,
  UpdateTicketSpaceDto,
} from './dto/ticket-space.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { TicketSpaceVisibilityGuard } from '../guards/ticket-space-visibility.guard';

@Controller('ticket-space')
@UseGuards(JwtAuthGuard, AuthorizationGuard, TicketSpaceVisibilityGuard)
export class TicketSpaceController {
  constructor(
    private readonly ticketSpaceService: TicketSpaceService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('100')
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

    return this.commonDbOperationService.search('ticket_space', item);
  }

  @AuthorizationPermissions('100')
  @Get('/check-prefix/:companyId/:prefix')
  async checkPrefix(
    @Param('companyId') companyId: number,
    @Param('prefix') prefix: string,
    @Request() req: any,
  ): Promise<{ exists: boolean }> {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.ticketSpaceService.checkPrefixExists(targetCompanyId, prefix);
  }

  @AuthorizationPermissions('97')
  @Post()
  createTicketSpace(
    @Body() createTicketSpaceDto: CreateTicketSpaceDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.createTicketSpace(
      createTicketSpaceDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Put(':id')
  updateTicketSpace(
    @Param('id') id: number,
    @Body() updateTicketSpaceDto: UpdateTicketSpaceDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.updateTicketSpace(
      id,
      updateTicketSpaceDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Patch(':id/toggle-status')
  toggleIsActive(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.toggleIsActive(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('100')
  @Get()
  getAllTicketSpaces(@Request() req: any): Promise<ResponseTicketSpaceDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getAllTicketSpaces(activeCompanyId, req.accessibleSpaceIds);
  }

  @AuthorizationPermissions('100')
  @Get(':id')
  getTicketSpaceById(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<ResponseTicketSpaceDto> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceById(id, activeCompanyId);
  }

  @AuthorizationPermissions('100')
  @Get(':id/configuration')
  getTicketSpaceConfiguration(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceConfiguration(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/status')
  getTicketSpaceStatusConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceStatusConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/severity')
  getTicketSpaceSeverityConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceSeverityConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/types')
  getTicketSpaceTypesConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceTypesConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/sla')
  getTicketSpaceSlaConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceSlaConfig(id, activeCompanyId);
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/impact')
  getTicketSpaceImpactConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceImpactConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/queue')
  getTicketSpaceQueueConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceQueueConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/members')
  getTicketSpaceMembersConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceMembersConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get(':id/config/create-ticket')
  getTicketSpaceCreateConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getTicketSpaceCreateConfig(
      id,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Get('company/:companyId')
  getAllTicketSpacesByCompanyId(
    @Param('companyId') companyId: number,
    @Request() req: any,
  ): Promise<ResponseTicketSpaceDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.ticketSpaceService.getAllTicketSpacesByCompanyId(
      targetCompanyId,
    );
  }

  @AuthorizationPermissions('99')
  @Delete(':id')
  deleteTicketSpace(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.deleteTicketSpace(id, activeCompanyId);
  }

  @AuthorizationPermissions('98')
  @Post(':id/status')
  addStatusToSpace(
    @Param('id') id: number,
    @Body() body: { name: string; color: string; base?: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addStatusToSpace(
      id,
      body.name,
      body.color,
      req.user,
      body.base as any,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Post(':id/status/existing')
  addExistingStatusToSpace(
    @Param('id') id: number,
    @Body() body: { statusId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addExistingStatusToSpace(
      id,
      body.statusId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Patch(':id/status/:statusId')
  updateSpaceStatus(
    @Param('id') id: number,
    @Param('statusId') statusId: number,
    @Body() body: { name?: string; color?: string },
    @Request() req: any,
  ) {
    return this.ticketSpaceService.updateSpaceStatus(
      id,
      statusId,
      body,
      req.user,
    );
  }

  @AuthorizationPermissions('98')
  @Delete(':id/status/:statusId')
  removeStatusFromSpace(
    @Param('id') id: number,
    @Param('statusId') statusId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.removeStatusFromSpace(
      id,
      statusId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Put(':id/status/sequence')
  updateStatusSequence(
    @Param('id') id: number,
    @Body() body: { statusSequences: { statusId: number; sequence: number }[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.updateStatusSequence(
      id,
      body.statusSequences,
      activeCompanyId,
    );
  }

  // Severity endpoints
  @AuthorizationPermissions('98')
  @Post(':id/severity')
  addSeverityToSpace(
    @Param('id') id: number,
    @Body() body: { name: string; color: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addSeverityToSpace(
      id,
      body.name,
      body.color,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Post(':id/severity/existing')
  addExistingSeverityToSpace(
    @Param('id') id: number,
    @Body() body: { severityId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addExistingSeverityToSpace(
      id,
      body.severityId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Patch(':id/severity/:severityId')
  updateSpaceSeverity(
    @Param('id') id: number,
    @Param('severityId') severityId: number,
    @Body() body: { name?: string; color?: string },
    @Request() req: any,
  ) {
    return this.ticketSpaceService.updateSpaceSeverity(
      id,
      severityId,
      body,
      req.user,
    );
  }

  @AuthorizationPermissions('98')
  @Delete(':id/severity/:severityId')
  removeSeverityFromSpace(
    @Param('id') id: number,
    @Param('severityId') severityId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.removeSeverityFromSpace(
      id,
      severityId,
      activeCompanyId,
    );
  }

  // Type endpoints
  @AuthorizationPermissions('98')
  @Post(':id/type')
  addTypeToSpace(
    @Param('id') id: number,
    @Body() body: { name: string; icon: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addTypeToSpace(
      id,
      body.name,
      body.icon,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Post(':id/type/existing')
  addExistingTypeToSpace(
    @Param('id') id: number,
    @Body() body: { typeId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addExistingTypeToSpace(
      id,
      body.typeId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Delete(':id/type/:typeId')
  removeTypeFromSpace(
    @Param('id') id: number,
    @Param('typeId') typeId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.removeTypeFromSpace(
      id,
      typeId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('98')
  @Patch(':id/type/:typeId')
  updateSpaceType(
    @Param('id') id: number,
    @Param('typeId') typeId: number,
    @Body() body: { name?: string; icon?: string },
    @Request() req: any,
  ) {
    return this.ticketSpaceService.updateSpaceType(
      id,
      typeId,
      body,
      req.user,
    );
  }

  @AuthorizationPermissions('98')
  @Put(':id/type/sequence')
  updateTypeSequence(
    @Param('id') id: number,
    @Body() body: { typeSequences: { typeId: number; order: number }[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.updateTypeSequence(
      id,
      body.typeSequences,
      activeCompanyId,
    );
  }

  // SLA endpoints
  @AuthorizationPermissions('98')
  @Post(':id/sla')
  addSlaToSpace(
    @Param('id') id: number,
    @Body()
    body: {
      severityId: number;
      responseTime: number;
      resolutionTime: number;
    },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addSlaToSpace(
      id,
      body.severityId,
      body.responseTime,
      body.resolutionTime,
      activeCompanyId,
      req.user
    );
  }

  @AuthorizationPermissions('98')
  @Delete(':id/sla/:slaId')
  removeSlaFromSpace(
    @Param('id') id: number,
    @Param('slaId') slaId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.removeSlaFromSpace(
      id,
      slaId,
      activeCompanyId,
    );
  }

  // Impact endpoints
  @AuthorizationPermissions('98')
  @Post(':id/impact')
  addImpactToSpace(
    @Param('id') id: number,
    @Body() body: { name: string; description: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addImpactToSpace(
      id,
      body.name,
      body.description,
      activeCompanyId,
      req.user
    );
  }

  @AuthorizationPermissions('98')
  @Put(':id/impact/:impactId')
  updateImpactInSpace(
    @Param('id') id: number,
    @Param('impactId') impactId: number,
    @Body() body: { name: string; description: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.updateImpactInSpace(
      id,
      impactId,
      body.name,
      body.description,
      activeCompanyId,
      req.user
    );
  }

  @AuthorizationPermissions('98')
  @Delete(':id/impact/:impactId')
  removeImpactFromSpace(
    @Param('id') id: number,
    @Param('impactId') impactId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.removeImpactFromSpace(
      id,
      impactId,
      activeCompanyId,
    );
  }

  // Queue endpoints
  @AuthorizationPermissions('98')
  @Post(':id/queue')
  addQueueToSpace(
    @Param('id') id: number,
    @Body() body: { name: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.addQueueToSpace(
      id,
      body.name,
      activeCompanyId,
      req.user
    );
  }

  @AuthorizationPermissions('98')
  @Delete(':id/queue/:queueId')
  removeQueueFromSpace(
    @Param('id') id: number,
    @Param('queueId') queueId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.removeQueueFromSpace(
      id,
      queueId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('100')
  @Post('bulk-status-counts')
  getBulkTicketStatusCounts(
    @Body('spaceIds') spaceIds: number[],
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketSpaceService.getBulkTicketStatusCounts(
      spaceIds,
      activeCompanyId,
    );
  }
}
