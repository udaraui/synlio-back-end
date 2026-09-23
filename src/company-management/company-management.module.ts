import { Module } from '@nestjs/common';
import { CompanyModule } from './company/company.module';
import { DivisionModule } from './division/division.module';

@Module({
  imports: [CompanyModule, DivisionModule],
})
export class CompanyManagementModule {}
