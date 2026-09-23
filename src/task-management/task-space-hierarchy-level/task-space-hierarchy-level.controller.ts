import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { TaskSpaceHierarchyLevelService } from './task-space-hierarchy-level.service';
import {
  CreateTaskSpaceHierarchyLevelDto,
  UpdateTaskSpaceHierarchyLevelDto,
} from './dto/task-space-hierarchy-level.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthUser } from '../../auth/auth-user.decorator';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('task-space-hierarchy-level')
export class TaskSpaceHierarchyLevelController {
  constructor(
    private readonly service: TaskSpaceHierarchyLevelService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('44')
  @Post('/search')
  search(@Body() item: QueryParam): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search(
      'task_space_hierarchy_level',
      item,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('44')
  @Get()
  getAll() {
    return this.service.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('44')
  @Get(':id')
  getById(@Param('id') id: number) {
    return this.service.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('45')
  @Post()
  create(@Body() dto: CreateTaskSpaceHierarchyLevelDto, @AuthUser() user: any) {
    return this.service.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('46')
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateTaskSpaceHierarchyLevelDto,
    @AuthUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('50')
  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }
}
