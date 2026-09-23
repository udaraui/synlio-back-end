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
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DivisionService } from './division.service';
import {
  CreateDivisionDto,
  ResponseDivisionDto,
  UpdateDivisionDto,
} from './dto/division.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';

@Controller('division')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class DivisionController {
  constructor(
    private readonly divisionService: DivisionService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('8','13')
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
        matchMode: '=',
        value: activeCompanyId,
      });
    }

    return this.commonDbOperationService.search('division', item);
  }

  @AuthorizationPermissions('5')
  @Post()
  createDivision(@Body() createDivisionDto: CreateDivisionDto, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.divisionService.createDivision(createDivisionDto, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('6')
  @Put(':id')
  updateDivision(
    @Param('id') id: number,
    @Body() updateDivisionDto: UpdateDivisionDto,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.divisionService.updateDivision(id, updateDivisionDto, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('8')
  @Get()
  getAllDivisions(@Request() req: any): Promise<ResponseDivisionDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.divisionService.getAllDivisions(activeCompanyId);
  }

  @AuthorizationPermissions('8','13')
  @Get('company/:companyId')
  getAllDivisionsByCompanyId(
    @Param('companyId') companyId: number,
    @Request() req: any,
  ): Promise<ResponseDivisionDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId = (activeCompanyId && activeCompanyId !== 0) ? activeCompanyId : companyId;
    return this.divisionService.getAllDivisionsByCompanyId(targetCompanyId);
  }

  @AuthorizationPermissions('6')
  @Patch(':id')
  disableDivision(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.divisionService.disableDivision(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('7')
  @Delete(':id')
  deleteDivision(
    @Param('id') id: number,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.divisionService.deleteDivision(id, req.user, activeCompanyId);
  }
}
