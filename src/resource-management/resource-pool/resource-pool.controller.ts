import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ResourcePoolService } from './resource-pool.service';
import {
  CreateResourcePool,
  UpdateResourcePoolDto,
} from './dto/resource-pool.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('resource-pool')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ResourcePoolController {
  constructor(
    private readonly ResourcePoolService: ResourcePoolService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('42')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;

    if (activeCompanyId && activeCompanyId !== 0) {
      if (!item.filters) item.filters = [];
      item.filters.push({
        field: 'company_id',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    return this.commonDbOperationService.search(
      'company_wise_resourse_pool_view',
      item,
    );
  }

  @AuthorizationPermissions('42')
  @Get('company/:companyId/division/:divisionId')
  getByCompanyAndDivision(
    @Param('companyId') companyId: number,
    @Param('divisionId') divisionId: number,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;

    return this.ResourcePoolService.getByCompanyAndDivision(
      targetCompanyId,
      divisionId,
    );
  }

  @AuthorizationPermissions('42')
  @Get(':id')
  getById(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ResourcePoolService.getById(id, activeCompanyId);
  }

  @AuthorizationPermissions('52')
  @Post()
  createResourcePool(
    @Body() createResourceDto: CreateResourcePool,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ResourcePoolService.createResourcePool(
      createResourceDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('43')
  @Put(':id')
  edit(
    @Body() updateResourcePoolDto: UpdateResourcePoolDto,
    @Param('id') id: number,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ResourcePoolService.updateResourcePool(
      id,
      updateResourcePoolDto,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('43')
  @Patch(':id')
  disableResourcePool(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ResourcePoolService.disable(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('43')
  @Delete(':id')
  deleteResourcePool(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ResourcePoolService.delete(id, activeCompanyId);
  }
}
