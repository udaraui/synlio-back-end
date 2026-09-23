import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrivilegeService } from './privilege.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { Public } from '../../auth/public.decorator';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';

@Controller('privilege')
// @UseGuards(AuthorizationGuard)
export class PrivilegeController {
  constructor(private readonly privilegeService: PrivilegeService) {}

  @Post('createPrivilege')
  createPrivilege(@Body() data) {
    return this.privilegeService.createPrivilege(data);
  }

  @Public()
  @Get('getAllPrivilege')
  getAllPrivilege() {
    return this.privilegeService.getAllPrivilege();
  }

  @Get('getAllPrivilegeByRole/:roleId')
  getAllPrivilegeByRole(@Param('roleId') roleId: number) {
    return this.privilegeService.getAllPrivilegeByRole(roleId);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('12')
  @Get('getAllPrivilegeByUser/:userId')
  getAllPrivilegeByUser(@Param('userId') userId: number) {
    return this.privilegeService.getAllPrivilegeByUser(userId);
  }
}
