import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationGuard } from './decorator/authorization.guard';
import { UserCompanyPrivilegeView } from '../user-management/user/user-company-privilege-view/user-company-privilege.entity';
import { UserCompanyView } from '../user-management/user/user-company-view/user-company.entity';
import { RedisModule } from '../redis/redis.module';
import { UserPrivilegeView } from '../user-management/user/user-privilege-view/user-privilege.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserCompanyPrivilegeView, UserCompanyView, UserPrivilegeView]),
    RedisModule,
  ],
  controllers: [AuthorizationController],
  providers: [AuthorizationService, AuthorizationGuard],
  exports: [AuthorizationService, AuthorizationGuard],
})
export class AuthorizationModule {}
