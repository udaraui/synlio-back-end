import { Module } from '@nestjs/common';
import { ExportExcelController } from './export-excel.controller';
import { ExportExcelService } from './export-excel.service';
import { CommonModule } from '../../common/common.module';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';

@Module({
  imports: [CommonModule, AuthorizationModule],
  controllers: [ExportExcelController],
  providers: [ExportExcelService, CommonDbOperationService],
})
export class ExportExcelModule {}
