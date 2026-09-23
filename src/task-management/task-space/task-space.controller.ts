import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TaskSpaceService } from './task-space.service';
import {
  CreateTaskSpaceDto,
  ResponseTaskSpaceDto,
  UpdateTaskSpaceDto,
} from './dto/task-space.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { TaskSpaceVisibilityGuard } from '../guards/task-space-visibility.guard';

@Controller('task-space')
@UseGuards(JwtAuthGuard, AuthorizationGuard, TaskSpaceVisibilityGuard)
export class TaskSpaceController {
  constructor(
    private readonly taskSpaceService: TaskSpaceService,
    private readonly commonDbOperationService: CommonDbOperationService,
    @InjectEntityManager() private readonly entityManager: EntityManager,
  ) {}

  @AuthorizationPermissions('44')
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

    return this.commonDbOperationService.search('task_space', item);
  }

  @AuthorizationPermissions('44')
  @Get('/check-prefix/:companyId/:prefix')
  async checkPrefix(
    @Param('companyId') companyId: number,
    @Param('prefix') prefix: string,
    @Request() req: any,
  ): Promise<{ exists: boolean }> {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.taskSpaceService.checkPrefixExists(targetCompanyId, prefix);
  }

  @AuthorizationPermissions('45')
  @Post()
  createTaskSpace(
    @Body() createTaskSpaceDto: CreateTaskSpaceDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.createTaskSpace(
      createTaskSpaceDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Put(':id')
  updateTaskSpace(
    @Param('id') id: number,
    @Body() updateTaskSpaceDto: UpdateTaskSpaceDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.updateTaskSpace(
      id,
      updateTaskSpaceDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('44')
  @Get()
  getAllTaskSpaces(@Request() req: any): Promise<ResponseTaskSpaceDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.getAllTaskSpaces(activeCompanyId, req.accessibleSpaceIds) as any;
  }

  @AuthorizationPermissions('44')
  @Get('company/:companyId')
  getAllTaskSpacesByCompanyId(
    @Param('companyId') companyId: number,
    @Request() req: any,
  ): Promise<ResponseTaskSpaceDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.taskSpaceService.getAllTaskSpacesByCompanyId(
      targetCompanyId,
      req.accessibleSpaceIds,
    ) as any;
  }

  @AuthorizationPermissions('44')
  @Get(':id')
  getTaskSpaceById(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<ResponseTaskSpaceDto> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.getTaskSpaceById(id, activeCompanyId) as any;
  }

  @AuthorizationPermissions('44')
  @Get(':id/task-status-counts')
  getTaskStatusCounts(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.getTaskStatusCounts(id, activeCompanyId);
  }

  @AuthorizationPermissions('44')
  @Post('bulk-status-counts')
  getBulkTaskStatusCounts(
    @Body('spaceIds') spaceIds: number[],
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.getBulkTaskStatusCounts(
      spaceIds,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Patch(':id/toggle-status')
  toggleIsActive(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.toggleIsActive(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('50')
  @Delete(':id')
  deleteTaskSpace(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.deleteTaskSpace(id, activeCompanyId);
  }

  // ── Config endpoints ─────────────────────────────────────────────────

  @AuthorizationPermissions('44')
  @Get(':id/config/status')
  getStatusConfig(
    @Param('id') id: number,
    @Query('companyId', ParseIntPipe) companyId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.taskSpaceService.getStatusConfig(id, targetCompanyId);
  }

  @AuthorizationPermissions('44')
  @Get(':id/config/severity')
  getSeverityConfig(
    @Param('id') id: number,
    @Query('companyId', ParseIntPipe) companyId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.taskSpaceService.getSeverityConfig(id, targetCompanyId);
  }

  @AuthorizationPermissions('44')
  @Get(':id/config/owners')
  getOwnersConfig(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.getOwnersConfig(id, activeCompanyId);
  }

  @AuthorizationPermissions('44')
  @Get(':id/config/resources')
  getResourcesConfig(
    @Param('id') id: number,
    @Request() req: any,
    @Query('companyId') companyId?: number,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : companyId
          ? Number(companyId)
          : undefined;
    return this.taskSpaceService.getResourcesConfig(id, targetCompanyId);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('46')
  @Patch(':id/status/:statusId')
  updateSpaceStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('statusId', ParseIntPipe) statusId: number,
    @Body() body: { name?: string; color?: string },
    @Request() req,
  ) {
    return this.taskSpaceService.updateSpaceStatus(
      id,
      statusId,
      body,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('46')
  @Patch(':id/severity/:severityId')
  updateSpaceSeverity(
    @Param('id', ParseIntPipe) id: number,
    @Param('severityId', ParseIntPipe) severityId: number,
    @Body() body: { name?: string; color?: string },
    @Request() req,
  ) {
    return this.taskSpaceService.updateSpaceSeverity(
      id,
      severityId,
      body,
      req.user,
    );
  }

  // ── Status endpoints ─────────────────────────────────────────────────

  @AuthorizationPermissions('46')
  @Post(':id/status')
  addStatusToSpace(
    @Param('id') id: number,
    @Body() body: { name: string; color: string; base?: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addStatusToSpace(
      id,
      body.name,
      body.color,
      req.user,
      body.base as any,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Post(':id/status/existing')
  addExistingStatusToSpace(
    @Param('id') id: number,
    @Body() body: { statusId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addExistingStatusToSpace(
      id,
      body.statusId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Delete(':id/status/:statusId')
  removeStatusFromSpace(
    @Param('id') id: number,
    @Param('statusId') statusId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.removeStatusFromSpace(
      id,
      statusId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Put(':id/status/sequence')
  updateStatusSequence(
    @Param('id') id: number,
    @Body() body: { statusSequences: { statusId: number; sequence: number }[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.updateStatusSequence(
      id,
      body.statusSequences,
      activeCompanyId,
    );
  }

  // ── Severity endpoints ───────────────────────────────────────────────

  @AuthorizationPermissions('46')
  @Post(':id/severity')
  addSeverityToSpace(
    @Param('id') id: number,
    @Body() body: { name: string; color: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addSeverityToSpace(
      id,
      body.name,
      body.color,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Post(':id/severity/existing')
  addExistingSeverityToSpace(
    @Param('id') id: number,
    @Body() body: { severityId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addExistingSeverityToSpace(
      id,
      body.severityId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Delete(':id/severity/:severityId')
  removeSeverityFromSpace(
    @Param('id') id: number,
    @Param('severityId') severityId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.removeSeverityFromSpace(
      id,
      severityId,
      activeCompanyId,
    );
  }

  // ── Resource endpoints ───────────────────────────────────────────────

  @AuthorizationPermissions('44')
  @Get(':id/resource-pools')
  getResourcePoolsForSpace(
    @Param('id') id: number,
    @Request() req: any,
    @Query('companyId') companyId?: number,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : companyId
          ? Number(companyId)
          : undefined;
    return this.taskSpaceService.getResourcePoolsForSpace(id, targetCompanyId);
  }

  @AuthorizationPermissions('44')
  @Post(':id/resource-pools/search')
  searchResourcePoolsForSpace(
    @Param('id') id: number,
    @Body() body: { query?: string; companyId?: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : body.companyId;
    return this.taskSpaceService.searchResourcePoolsForSpace(
      id,
      body.query ?? '',
      targetCompanyId,
    );
  }

  @AuthorizationPermissions('44')
  @Post(':id/resource/search')
  searchResourcesForSpace(
    @Param('id') id: number,
    @Body() body: { query?: string; rows?: number; companyId?: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : body.companyId;
    return this.taskSpaceService.searchResourcesForSpace(
      body.query,
      body.rows ?? 3,
      targetCompanyId,
      id,
    );
  }

  @AuthorizationPermissions('46')
  @Post(':id/resource')
  addResourceToSpace(
    @Param('id') id: number,
    @Body() body: { resourceId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addResourceToSpace(
      id,
      body.resourceId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Delete(':id/resource/:resourceId')
  removeResourceFromSpace(
    @Param('id', ParseIntPipe) id: number,
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.removeResourceFromSpace(
      id,
      resourceId,
      activeCompanyId,
    );
  }

  // ── Owner endpoints ──────────────────────────────────────────────────

  @AuthorizationPermissions('46')
  @Post(':id/owner')
  addOwnerToSpace(
    @Param('id') id: number,
    @Body() body: { userId: number },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addOwnerToSpace(
      id,
      body.userId,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Delete(':id/owner/:userId')
  removeOwnerFromSpace(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.removeOwnerFromSpace(
      id,
      userId,
      activeCompanyId,
    );
  }

  // ── Hierarchy Level config endpoints ────────────────────────────────

  @AuthorizationPermissions('44')
  @Get(':id/config/hierarchy-level')
  getHierarchyLevelConfig(
    @Param('id') id: number,
    @Request() req: any,
    @Query('companyId') companyId?: number,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0
        ? activeCompanyId
        : companyId
          ? Number(companyId)
          : undefined;
    return this.taskSpaceService.getHierarchyLevelConfig(id, targetCompanyId);
  }

  /** Bulk save – replaces all hierarchy configs for the space in a single call */
  @AuthorizationPermissions('46')
  @Post(':id/hierarchy-level/bulk')
  saveAllHierarchyLevels(
    @Param('id') id: number,
    @Body() body: { levels: { name: string; icon?: string; color?: string }[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.saveAllHierarchyLevels(
      id,
      body.levels,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Post(':id/hierarchy-level')
  addHierarchyLevelToSpace(
    @Param('id') id: number,
    @Body()
    body: { name: string; sequence?: number; icon?: string; color?: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.addHierarchyLevelToSpace(
      id,
      {
        name: body.name,
        sequence: body.sequence ?? 0,
        icon: body.icon,
        color: body.color,
      },
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Patch(':id/hierarchy-level/:configId')
  patchHierarchyLevelConfig(
    @Param('id', ParseIntPipe) id: number,
    @Param('configId', ParseIntPipe) configId: number,
    @Body() body: { name?: string; icon?: string; color?: string },
    @Request() req,
  ) {
    return this.taskSpaceService.patchHierarchyLevelConfig(
      id,
      configId,
      body,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('46')
  @Put(':id/hierarchy-level/:configId')
  updateHierarchyLevelConfig(
    @Param('id') id: number,
    @Param('configId') configId: number,
    @Body()
    body: { sequence?: number; name?: string; icon?: string; color?: string },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.updateHierarchyLevelConfig(
      id,
      configId,
      body,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('46')
  @Delete(':id/hierarchy-level/:configId')
  removeHierarchyLevelFromSpace(
    @Param('id') id: number,
    @Param('configId') configId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskSpaceService.removeHierarchyLevelFromSpace(
      id,
      configId,
      activeCompanyId,
    );
  }
}
