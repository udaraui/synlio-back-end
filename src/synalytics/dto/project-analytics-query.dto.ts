import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProjectAnalyticsQueryDto {
  @IsNumber()
  companyId: number;

  @IsOptional()
  @IsNumber()
  taskSpaceId?: number;

  @IsOptional()
  @IsNumber()
  assigneeResourceId?: number;

  @IsOptional()
  @IsArray()
  statusBases?: string[];

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
