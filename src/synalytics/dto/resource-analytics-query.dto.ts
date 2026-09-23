import { IsNumber } from 'class-validator';

export class ResourceAnalyticsQueryDto {
  @IsNumber()
  companyId: number;
}

