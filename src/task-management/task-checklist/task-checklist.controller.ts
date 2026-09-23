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
import { ChecklistService } from '../../common/checklist/checklist.service';
import type { UpdateChecklistDto } from '../../common/checklist/checklist.dto';

/** Task-side entry point onto the shared checklist table. */
@Controller('task-management/task-checklist')
export class TmTaskChecklistController {
  constructor(private readonly service: ChecklistService) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55')
  @Post()
  create(
    @Body()
    dto: {
      name: string;
      taskId: number;
      isChecked?: boolean;
      assigneeId?: number | null;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        name: dto.name,
        entityType: 'Task',
        entityId: dto.taskId,
        isChecked: dto.isChecked,
        assigneeId: dto.assigneeId,
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('56')
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateChecklistDto,
    @Request() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.update(+id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54')
  @Get('task/:taskId')
  findByTask(@Param('taskId') taskId: number) {
    return this.service.findByEntity('Task', +taskId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('57')
  @Delete(':id')
  delete(@Param('id') id: number, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.delete(+id, req.user);
  }
}
