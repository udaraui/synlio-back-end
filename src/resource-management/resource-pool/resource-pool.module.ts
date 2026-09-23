import { Module } from '@nestjs/common';
import { ResourcePoolController } from './resource-pool.controller';
import { ResourcePoolService } from './resource-pool.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcePool } from './resource-pool.entity';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserCompanyPrivilegeView } from '../../user-management/user/user-company-privilege-view/user-company-privilege.entity';
import { UserCompanyView } from '../../user-management/user/user-company-view/user-company.entity';

@Module({
  controllers: [ResourcePoolController],
  providers: [ResourcePoolService, CommonDbOperationService],
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([
      ResourcePool,
      UserCompanyPrivilegeView,
      UserCompanyView,
    ]),
  ],
})
export class ResourcePoolModule {}
