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
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { TaskVisibilityGuard } from '../guards/task-visibility.guard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { TmTaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadTaskAttachmentToAzure } from '../../common/azure/azure-image-upload';

@Controller('task-management/task')
@UseGuards(JwtAuthGuard, AuthorizationGuard, TaskVisibilityGuard)
export class TmTaskController {
  constructor(
    private readonly taskService: TmTaskService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) { }

  @AuthorizationPermissions('54')
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

    console.time('Task Search Query Execution');
    const result = await this.commonDbOperationService.search('tm_task', {
      ...item,
    });
    console.timeEnd('Task Search Query Execution');
    return result;
  }

  @AuthorizationPermissions('54')
  @Post('/bulk-relations')
  getBulkTaskRelations(
    @Body('taskIds') taskIds: number[],
    @Request() req: any,
  ): Promise<Record<number, any>> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getBulkTaskRelations(taskIds, activeCompanyId);
  }

  @AuthorizationPermissions('55')
  @Post()
  create(@Body() dto: CreateTaskDto, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.create(dto, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get('next-code/:taskSpaceId')
  getNextTaskCode(
    @Param('taskSpaceId') taskSpaceId: number,
    @Query('hierarchyLevelConfigId') hierarchyLevelConfigId: number,
    @Request() req: any,
    @Query('parentTaskId') parentTaskId?: number,
  ): Promise<{ code: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getNextTaskCodeByIds(
      +taskSpaceId,
      +hierarchyLevelConfigId,
      parentTaskId !== undefined ? +parentTaskId : null,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('54')
  @Get('peek-next-code/:taskSpaceId')
  peekNextTaskCode(
    @Param('taskSpaceId') taskSpaceId: number,
    @Query('hierarchyLevelConfigId') hierarchyLevelConfigId: number,
    @Request() req: any,
    @Query('parentTaskId') parentTaskId?: number,
  ): Promise<{ code: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.peekNextTaskCodeByIds(
      +taskSpaceId,
      +hierarchyLevelConfigId,
      parentTaskId !== undefined ? +parentTaskId : null,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('54')
  @Get(':id/core')
  findCore(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskBaseById(+id, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get(':id/assignees')
  findAssignees(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskAssignees(+id, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get(':id/child-tasks')
  findChildTasks(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskChildTasks(+id, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get(':id/task-attachments')
  findTaskAttachments(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskAttachments(+id, activeCompanyId);
  }

  @AuthorizationPermissions('56')
  @Delete('task-attachments/:attachmentId')
  deleteTaskAttachment(
    @Param('attachmentId') attachmentId: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.deleteTaskAttachment(
      +attachmentId,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
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

  @AuthorizationPermissions('56')
  @Post('task-attachments')
  createTaskAttachment(
    @Body() body: { taskId: number; link: string; fileName?: string },
    @Request() req: any,
  ) {
    if (!body?.taskId || !body?.link) {
      throw new Error('taskId and link are required');
    }
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.createTaskAttachment(
      body.taskId,
      body.link,
      body.fileName,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('54')
  @Get(':id/checklist')
  findTaskChecklists(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskChecklists(+id, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get(':id/events')
  findTaskEvents(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskEvents(+id, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.getTaskById(+id, activeCompanyId);
  }

  @AuthorizationPermissions('56')
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateTaskDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.update(+id, dto, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('57')
  @Delete(':id')
  delete(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.delete(+id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('56')
  @Patch(':id/name')
  patchName(
    @Param('id') id: number,
    @Body() body: { name: string; oldName?: string | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchName(
      +id,
      body.name,
      body.oldName ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/status')
  patchStatus(
    @Param('id') id: number,
    @Body()
    body: {
      statusId: number | null;
      oldStatusId?: number | null;
      parentTaskId?: number | null;
    },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchStatus(
      +id,
      body.statusId,
      body.oldStatusId ?? null,
      body.parentTaskId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/severity')
  patchSeverity(
    @Param('id') id: number,
    @Body() body: { severityId: number | null; oldSeverityId?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchSeverity(
      +id,
      body.severityId,
      body.oldSeverityId ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/assignee')
  patchAssignee(
    @Param('id') id: number,
    @Body() body: { assigneeId: number | null; oldAssigneeId?: number | null; assigneeSkill?: string | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchAssignee(
      +id,
      body.assigneeId,
      body.oldAssigneeId ?? null,
      req.user,
      activeCompanyId,
      body.assigneeSkill ?? null,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/co-assignees')
  patchCoAssignees(
    @Param('id') id: number,
    @Body() body: { coAssigneeIds: number[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchCoAssignees(
      +id,
      body.coAssigneeIds ?? [],
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/labels')
  patchLabels(
    @Param('id') id: number,
    @Body() body: { labelIds: number[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchLabels(
      +id,
      body.labelIds ?? [],
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/hierarchy-level')
  patchHierarchyLevel(
    @Param('id') id: number,
    @Body() body: { hierarchyLevelConfigId: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchHierarchyLevel(
      +id,
      body.hierarchyLevelConfigId,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/progress')
  patchProgress(
    @Param('id') id: number,
    @Body()
    body: { progressPercentage: number; oldProgressPercentage?: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchProgress(
      +id,
      body.progressPercentage,
      body.oldProgressPercentage ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/special')
  patchSpecial(
    @Param('id') id: number,
    @Body() body: { special: boolean },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchSpecial(
      +id,
      body.special,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/description')
  patchDescription(
    @Param('id') id: number,
    @Body() body: { description: string | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchDescription(
      +id,
      body.description ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/actual-dates')
  patchActualDates(
    @Param('id') id: number,
    @Body()
    body: { actualStartDate: string | null; actualEndDate: string | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchActualDates(
      +id,
      body.actualStartDate ?? null,
      body.actualEndDate ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/effort')
  patchEffort(
    @Param('id') id: number,
    @Body()
    body: { estimateEffort: number | null; actualEffort: number | null },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchEffort(
      +id,
      body.estimateEffort ?? null,
      body.actualEffort ?? null,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/members')
  patchMembers(
    @Param('id') id: number,
    @Body() body: { memberIds: number[] },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchMembers(
      +id,
      body.memberIds ?? [],
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('56')
  @Patch(':id/dates')
  patchDates(
    @Param('id') id: number,
    @Body()
    body: {
      startDate: string | null;
      dueDate: string | null;
      oldStartDate?: string | null;
      oldDueDate?: string | null;
      parentTaskId?: number | null;
    },
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.patchDates(
      +id,
      body.startDate,
      body.dueDate,
      body.oldStartDate ?? null,
      body.oldDueDate ?? null,
      body.parentTaskId ?? null,
      req.user,
      activeCompanyId,
    );
  }

}
