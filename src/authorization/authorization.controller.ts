import { Controller, Get, Param, Query } from '@nestjs/common';

import { AuthorizationService } from './authorization.service';

@Controller('authorization')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get()
  getCompanyById() {
    return this.authorizationService.setAllUserCompanyPrivilegesIntoCache();
  }

  @Get('get-user-company-privileges')
  getUserCompanyPrivileges(@Query('userId') userId: number) {
    return this.authorizationService.getUserCompanyPrivilegesFromCache(userId);
  }

  @Get('getCompanyByUserId/:userId')
  getCompanyByUserId(@Param('userId') userId: number) {
    return this.authorizationService.getUserCompanyByUserId(userId);
  }
}
