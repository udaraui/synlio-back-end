import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { UserCompanyPrivilegeView } from '../user/user-company-privilege-view/user-company-privilege.entity';
import { UserCompanyView } from '../user/user-company-view/user-company.entity';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { RedisService } from '../../redis/redis.service';
import { UserPrivilegeView } from '../user/user-privilege-view/user-privilege.entity';

@Module({
  controllers: [RoleController],
  providers: [
    RoleService,
    CommonDbOperationService,
    AuthorizationService,
    RedisService,
  ],
  imports: [
    TypeOrmModule.forFeature([Role, UserCompanyPrivilegeView, UserCompanyView, UserPrivilegeView]),
  ],
  exports: [RoleService],
})
export class RoleModule {}
