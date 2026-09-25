import {
  Controller,
  Get,
  Req,
  Post,
  UseGuards,
  UseInterceptors,
  Request,
  UploadedFile,
  Param,
  Patch,
  Put,
  Body,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Company } from './company.entity';
import {
  CreateCompanyDto,
  ResponseCompanyDto,
  UpdateCompanyDto,
  UpdateMeetingProvidersDto,
} from './dto/company.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';

@Controller('company')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) { }

  @AuthorizationPermissions('4')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;

    if (activeCompanyId && activeCompanyId !== 0) {
      if (!item.filters) item.filters = [];
      item.filters.push({
        field: 'id',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    return this.commonDbOperationService.search('company', item);
  }

  @AuthorizationPermissions('4', '8')
  @Post('/searchById')
  async searchById(
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

    return this.commonDbOperationService.search('division', item);
  }
  @AuthorizationPermissions('1')
  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  async createCompanyWithLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() createCompanyDto: CreateCompanyDto,
  ): Promise<Company> {
    let users: number[] = [];
    if (createCompanyDto.users) {
      users = createCompanyDto.users;
    }

    return this.companyService.createCompany(
      {
        company: createCompanyDto.company,
        company_code: createCompanyDto.company_code,
        suspend_on: createCompanyDto.suspend_on,
        isActive: createCompanyDto.isActive,
        users: users,
      },
      req.user,
      file,
    );
  }

  @AuthorizationPermissions('2')
  @Put(':id')
  @UseInterceptors(FileInterceptor('logo'))
  async updateCompanyWithLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Param('id') id: number,
  ): Promise<Company> {
    return this.companyService.updateCompany(
      id,
      {
        company: updateCompanyDto.company,
        company_code: updateCompanyDto.company_code,
        suspend_on: updateCompanyDto.suspend_on,
        isActive: updateCompanyDto.isActive,
      },
      req.user,
      file,
    );
  }

  @AuthorizationPermissions('4')
  @Get()
  getAllCompany(@Req() req: any): Promise<ResponseCompanyDto[]> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.companyService.getAllCompany(activeCompanyId);
  }

  @AuthorizationPermissions('4')
  @Get(':id')
  async getCompanyById(
    @Param('id') id: number,
    @Req() req: any,
  ): Promise<ResponseCompanyDto> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.companyService.getCompanyById(id, activeCompanyId);
  }

  @AuthorizationPermissions('3')
  @Patch(':id')
  deleteCompany(@Param('id') id: number, @Request() req) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.companyService.deleteCompany(id, req.user, activeCompanyId);
  }


  @Get(':id/meeting-providers')
  async getMeetingProviders(
    @Param('id') id: number,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const company = await this.companyService.getCompanyById(id, activeCompanyId);
    return {
      allowedMeetingProviders: company.allowedMeetingProviders ?? ['teams', 'zoom', 'google_meet'],
    };
  }

  @Patch(':id/meeting-providers')
  updateMeetingProviders(
    @Param('id') id: number,
    @Body() dto: UpdateMeetingProvidersDto,
    @Request() req,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.companyService.updateMeetingProviders(
      id,
      dto.allowedMeetingProviders,
      req.user,
      activeCompanyId,
    );
  }
}
