import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { CommonModule } from '../../common/common.module';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';

@Module({
  imports: [AuthorizationModule, CommonModule],
  controllers: [CompanyController],
  providers: [CompanyService, CommonDbOperationService],
  exports: [CompanyService],
})
export class CompanyModule {}
