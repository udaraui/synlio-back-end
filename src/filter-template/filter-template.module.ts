import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilterTemplate } from './filter-template.entity';
import { FilterTemplateService } from './filter-template.service';
import { FilterTemplateController } from './filter-template.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FilterTemplate])],
  controllers: [FilterTemplateController],
  providers: [FilterTemplateService],
  exports: [FilterTemplateService],
})
export class FilterTemplateModule {}
