import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { UserCompanyRole } from './user-company-role.entity';
import { UserCompanyView } from './user-company-view/user-company.entity';
import { UserCompanyPrivilegeView } from './user-company-privilege-view/user-company-privilege.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Privilege } from '../privilege/privilege.entity';
import { RedisService } from '../../redis/redis.service';
import { RoleModule } from '../role/role.module';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { UserConfig } from './user-config.entity';
import { UserConfigService } from './user-config.service';
import { UserConfigController } from './user-config.controller';
import { AuthorizationModule } from '../../authorization/authorization.module';

@Module({
  controllers: [UserController, UserConfigController],
  providers: [
    UserService,
    UserConfigService,
    RedisService,
    CommonDbOperationService,
  ],
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserCompanyRole,
      UserCompanyView,
      UserCompanyPrivilegeView,
      Privilege,
      UserConfig,
    ]),
    RoleModule,
    AuthorizationModule,
  ],
  exports: [UserService, UserConfigService],
})
export class UserModule {}
