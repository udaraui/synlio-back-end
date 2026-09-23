import { Module } from '@nestjs/common';
import { SkillCategoryModule } from './skill-management/skill-category/skill-category.module';
import { SkillLevelModule } from './skill-management/skill-level/skill-level.module';
import { SkillModule } from './skill-management/skill/skill.module';
import { CalendarModule } from './calendar/calendar.module';
import { ResourceModule } from './resource/resource.module';
import { ResourcePoolModule } from './resource-pool/resource-pool.module';
import { CurrencyModule } from './currency/currency.module';

@Module({
  imports: [
    SkillModule,
    SkillLevelModule,
    SkillCategoryModule,
    CalendarModule,
    ResourceModule,
    ResourcePoolModule,
    CurrencyModule,
  ],
})
export class ResourceManagementModule {}
