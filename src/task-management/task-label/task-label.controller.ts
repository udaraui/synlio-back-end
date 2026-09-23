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
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { TmTaskLabelService } from './task-label.service';
import {
  AssignTmTaskLabelsDto,
  CreateTmTaskLabelDto,
  UpdateTmTaskLabelDto,
} from './dto/task-label.dto';
@Controller('task-management/task-label')
export class TmTaskLabelController {
  constructor(
    private readonly service: TmTaskLabelService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54')
  @Post('/search')
  search(@Body() item: QueryParam): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('tm_task_label', item);
  }
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('54')
  @Get('/by-task-space/:taskSpaceId')
  findByTaskSpace(@Param('taskSpaceId') taskSpaceId: number) {
    return this.service.findByTaskSpace(+taskSpaceId);
  }
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('55')
  @Post('/create')
  create(@Body() dto: CreateTmTaskLabelDto, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.create(dto, req.user);
  }
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('56')
  @Post('/assign-labels')
  assignLabels(@Body() dto: AssignTmTaskLabelsDto, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.assignAndCreateLabels(dto, req.user);
  }
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('56')
  @Put('/update/:id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateTmTaskLabelDto,
    @Request() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.update(+id, dto, req.user);
  }
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('56')
  @Delete('/delete/:id')
  delete(@Param('id') id: number) {
    return this.service.delete(+id);
  }
}
