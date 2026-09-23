import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Request,
  UseGuards,
  Headers,
  Delete,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto, ResponseRoleDto, UpdateRoleDto } from './dto/role.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('role')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('12', '13')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Req() req: any,
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

    return this.commonDbOperationService.search('role', item);
  }

  @AuthorizationPermissions('9')
  @Post()
  createRole(@Body() createRoleDto: CreateRoleDto, @Request() req) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.createRole(
      createRoleDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('12')
  @Get(':id')
  getRoleById(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<ResponseRoleDto> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.getRoleById(id, activeCompanyId);
  }

  @AuthorizationPermissions('12')
  @Get()
  getAllrole(@Request() req: any): Promise<ResponseRoleDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.getAllrole(activeCompanyId);
  }

  @AuthorizationPermissions('12', '13')
  @Get('company/:companyId')
  getAllroleByCompany(
    @Param('companyId') companyId: number,
    @Request() req: any,
  ): Promise<ResponseRoleDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.roleService.getAllroleByCompany(targetCompanyId);
  }

  @AuthorizationPermissions('10')
  @Put(':id')
  updateRole(
    @Param('id') id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.updateRole(
      id,
      updateRoleDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('10')
  @Patch(':id')
  disableRole(@Param('id') id: number, @Request() req) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.disableRole(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('11')
  @Delete(':id')
  deleteRole(@Param('id') id: number, @Request() req) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.deleteRole(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('10')
  @Post('assignPrivilegeToRole')
  assignPrivilegeToRole(@Body() data: any, @Request() req) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.roleService.assignPrivilegeToRole(
      data.roleId,
      data.privilegeIds,
      req.user,
      activeCompanyId,
    );
  }
}
