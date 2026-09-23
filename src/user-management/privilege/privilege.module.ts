import { Module } from '@nestjs/common';
import { PrivilegeController } from './privilege.controller';
import { Privilege } from './privilege.entity';
import { PrivilegeService } from './privilege.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { CommonModule } from '../../common/common.module';

@Module({
  controllers: [PrivilegeController],
  providers: [PrivilegeService],
  imports: [
    TypeOrmModule.forFeature([Privilege]),
    AuthorizationModule,
    CommonModule,
  ],
})
export class PrivilegeModule {}
