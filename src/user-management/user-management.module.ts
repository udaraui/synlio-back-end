import { Module } from '@nestjs/common';
import { PrivilegeController } from './privilege/privilege.controller';
import { PrivilegeService } from './privilege/privilege.service';
import { RoleModule } from './role/role.module';
import { PrivilegeModule } from './privilege/privilege.module';
import { UserModule } from './user/user.module';
import { Privilege } from './privilege/privilege.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CommonModule } from '../common/common.module';

@Module({
  controllers: [PrivilegeController],
  providers: [PrivilegeService],
  imports: [
    RoleModule,
    PrivilegeModule,
    UserModule,
    AuthorizationModule,
    CommonModule,
    TypeOrmModule.forFeature([Privilege]),
  ],
})
export class UserManagementModule {}
