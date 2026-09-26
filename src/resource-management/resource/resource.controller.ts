import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/resource.dto';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('resource')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ResourceController {
  constructor(
    private readonly resourceService: ResourceService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('38', '100')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const companyId = req.activeCompany?.companyId;

    if (companyId && companyId !== 0) {
      if (!item.filters) item.filters = [];
      item.filters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: companyId,
      });
    }

    return this.commonDbOperationService.search(
      'CompanyWiseResourceView',
      item,
    );
  }

  @AuthorizationPermissions('38', '100')
  @Post('/search-with-skills')
  async searchWithSkills(
    @Body() body: { query?: string; rows?: number },
    @Req() req: any,
  ): Promise<any[]> {
    const companyId = req.activeCompany?.companyId;
    return this.resourceService.searchResourcesWithSkills(
      body.query,
      body.rows ?? 10,
      companyId && companyId !== 0 ? companyId : undefined,
    );
  }

  @AuthorizationPermissions('39')
  @Post()
  @UseInterceptors(FileInterceptor('profile_pic'))
  createResource(
    @Body() createResourceDto: CreateResourceDto,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
        fileIsRequired: false,
      }),
    ) file: Express.Multer.File,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;

    return this.resourceService.createResource(
      createResourceDto,
      req.user,
      activeCompanyId,
      file,
    );
  }

  @AuthorizationPermissions('40')
  @UseInterceptors(FileInterceptor('profile_pic'))
  @Put('/:id')
  async updateResource(
    @Param('id') id: number,
    @Body() body: any,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
        fileIsRequired: false,
      }),
    ) file: Express.Multer.File,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;

    return await this.resourceService.updateResource(
      id,
      body,
      req.user,
      activeCompanyId,
      file,
    );
  }

  @AuthorizationPermissions('38')
  @Get()
  getAllResources(@Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.getAllResources(activeCompanyId);
  }

  // @AuthorizationPermissions('38')
  @Get('getAllResourcesByCompany/:companyId/:divisionId')
  getAllResourcesByCompany(
    @Param('companyId') companyId: number,
    @Param('divisionId') divisionId: number,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.resourceService.getAllResourcesByCompany(
      targetCompanyId,
      divisionId,
    );
  }

  @AuthorizationPermissions('38')
  @Get('company/:companyId')
  getAllResourcesByCompanyOnly(
    @Param('companyId') companyId: number,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const targetCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;
    return this.resourceService.getAllResourcesByCompanyOnly(targetCompanyId);
  }

  @AuthorizationPermissions('38')
  @Get('check-email/:email')
  checkEmailExists(@Param('email') email: string, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.checkEmailExists(email, activeCompanyId);
  }

  @AuthorizationPermissions('38', '100')
  @Get('my-direct-reports')
  getMyDirectReports(@Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    const userEmail = req.user?.email;
    return this.resourceService.getMyDirectReports(userEmail, activeCompanyId);
  }

  @AuthorizationPermissions('38')
  @Get(':id')
  findOne(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.findOne(id, activeCompanyId);
  }

  @AuthorizationPermissions('38')
  @Get(':id/skills')
  getResourceSkills(
    @Param('id') id: number,
    @Req() req: any,
    @Query('count') count: string = '-1',
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.getResourceSkills(id, parseInt(count, 10), activeCompanyId);
  }

  @AuthorizationPermissions('40')
  @Patch(':id/sync-user')
  async syncUserData(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.syncUserData(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('40')
  @Patch(':id')
  disable(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.disable(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('40')
  @Patch('quickEdit/:id')
  async quickEdit(
    @Param('id') id: number,
    @Body() body: { field: string; value: any }, // Extract field and value from body
    @Req() req: any,
  ) {
    const { field, value } = body;
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.quickEdit(
      id,
      field,
      value,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('41')
  @Delete(':id')
  remove(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.remove(+id, activeCompanyId);
  }

  @AuthorizationPermissions('38')
  @Get(':id/active-counts')
  getResourceActiveCounts(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.resourceService.getResourceActiveCounts(+id, activeCompanyId);
  }
}
