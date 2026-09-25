import {
  Controller,
  Request,
  Body,
  UseGuards,
  Get,
  Req,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import {
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseIntPipe } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UserService } from './user.service';
import { CreateUserDto, ResponseUserDto } from './dto/user.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationGuard } from 'src/authorization/decorator/authorization.guard';

// create user permission id is 13
// view user permission id is 16
// edit user permission id is 14
// delete user permission id is 15

@Controller('user')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @AuthorizationPermissions('13')
  @Post()
  @UseInterceptors(FileInterceptor('profile_picture'))
  async createUser(
    @Request() req,
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ResponseUserDto> {
    if (file && file.filename) {
      createUserDto.profile_picture = file.filename;
    }

    console.log(req.activeCompany);

    // Parse JSON fields that come as strings from FormData
    if (
      createUserDto.companyIds &&
      typeof createUserDto.companyIds === 'string'
    ) {
      createUserDto.companyIds = JSON.parse(createUserDto.companyIds);
    }

    if (
      createUserDto.divisionIds &&
      typeof createUserDto.divisionIds === 'string'
    ) {
      createUserDto.divisionIds = JSON.parse(createUserDto.divisionIds);
    }

    if (
      createUserDto.userCompanyRoles &&
      typeof createUserDto.userCompanyRoles === 'string'
    ) {
      createUserDto.userCompanyRoles = JSON.parse(
        createUserDto.userCompanyRoles,
      );
    }

    // Convert string boolean to actual boolean
    if (createUserDto.isActive && typeof createUserDto.isActive === 'string') {
      createUserDto.isActive = createUserDto.isActive === 'true';
    }

    const activeCompanyId = req.activeCompany?.companyId;

    return await this.userService.createUser(
      createUserDto,
      req.user,
      file,
      activeCompanyId,
    );
  }

  @Get('me')
  async getMe(@Request() req) {
    return this.userService.getUserProfile(req.user.userId);
  }

  /**
   * GET /user/company-users
   * Returns all users in the current company for attendee selection in internal meetings.
   * No admin privilege required — any authenticated user can see company members.
   */
  @Get('company-users')
  async getCompanyUsers(@Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    if (!activeCompanyId) return [];
    return this.userService.getUsersByCompany(activeCompanyId);
  }

  @AuthorizationPermissions('16')
  @Get(':id')
  async getUserProfile(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    const companyId = req.activeCompany?.companyId;
    const user = await this.userService.getUserById(id, companyId);
    if (!user) {
      return null;
    }
    return user; // getUserById already excludes password
  }

  @AuthorizationPermissions('16','39')
  @Get('search-by-email/:email')
  async searchByEmail(
    @Param('email') email: string,
  ): Promise<any> {
    return this.userService.searchByEmail(email);
  }

  @AuthorizationPermissions('16')
  @Post('search')
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

    const result = await this.commonDbOperationService.search('CompanyWiseUserView', item);
    if (result.data?.length) {
      const userIds = result.data.map((u: any) => u.id).filter((id: any) => typeof id === 'number');
      const rolesMap = await this.userService.getUserCompanyRolesByUserIds(userIds, companyId && companyId !== 0 ? companyId : undefined);
      result.data = result.data.map((u: any) => ({ ...u, userCompanyRoles: rolesMap[u.id] || [] }));
    }
    return result;
  }

  @AuthorizationPermissions('14')
  @Put('/:id')
  @UseInterceptors(FileInterceptor('profile_picture'))
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() user: any,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    // Handle file upload

    // Parse JSON fields that come as strings from FormData
    if (user.companyIds && typeof user.companyIds === 'string') {
      user.companyIds = JSON.parse(user.companyIds);
    }

    if (user.divisionIds && typeof user.divisionIds === 'string') {
      user.divisionIds = JSON.parse(user.divisionIds);
    }

    if (user.userCompanyRoles && typeof user.userCompanyRoles === 'string') {
      user.userCompanyRoles = JSON.parse(user.userCompanyRoles);
    }

    // Convert string boolean to actual boolean
    if (user.isActive && typeof user.isActive === 'string') {
      user.isActive = user.isActive === 'true';
    }

    // Add the id from the URL parameter to the user object
    user.id = id;

    const activeCompanyId = req.activeCompany?.companyId;

    return this.userService.updateUser(user, req.user, file, activeCompanyId);
  }

  @AuthorizationPermissions('16')
  @Get('company/:companyId/division/:divisionId')
  async findAllUsersByCompanyAndDivision(
    @Request() req,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('divisionId', ParseIntPipe) divisionId: number,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    
    // Ensure the requested company matches the active company (unless system scope)
    const effectiveCompanyId = (activeCompanyId && activeCompanyId !== 0) 
      ? activeCompanyId 
      : companyId;

    return this.userService.findAllUsersByCompanyAndDivision(
      effectiveCompanyId,
      divisionId,
    );
  }

  @AuthorizationPermissions('14')
  @Patch(':id')
  disableUser(@Param('id') id: number, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.userService.disableUser(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('15')
  @Get(':id/delete-check')
  checkDeleteUser(
    @Param('id') id: number,
    @Query('companyId') companyId: string,
    @Request() req: any,
  ) {
    const activeCompanyId = companyId ? parseInt(companyId) : req.activeCompany?.companyId;
    return this.userService.checkDeleteUser(id, activeCompanyId);
  }

  @AuthorizationPermissions('15')
  @Delete(':id')
  deleteUser(
    @Param('id') id: number,
    @Request() req: any,
    @Body() body: any,
  ) {
    const activeCompanyId = body?.companyId || req.activeCompany?.companyId;
    const deleteLinkedResources = body?.deleteLinkedResources === true;
    const deleteResource = body?.deleteResource === true;
    return this.userService.deleteUser(
      id,
      req.user,
      activeCompanyId,
      deleteLinkedResources,
      deleteResource,
    );
  }

  @AuthorizationPermissions('15')
  @Patch('/password-reset/:id')
  PasswordReset(@Param('id') id: number, @Request() req: any, @Body() data: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.userService.PasswordReset(id, req.user, data, activeCompanyId);
  }

  // @AuthorizationPermissions('14')
  @Put('/default-company/:companyId')
  async setDefaultCompany(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Request() req: any,
  ) {
    return this.userService.setDefaultCompany(req.user.userId, companyId);
  }
}
