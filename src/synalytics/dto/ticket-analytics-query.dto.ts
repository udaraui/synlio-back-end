import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class TicketAnalyticsQueryDto {
  @IsNumber()
  companyId: number;

  @IsOptional()
  @IsNumber()
  spaceId?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  assigneePermissionIds?: number[];

  @IsOptional()
  @IsString()
  assigneeName?: string;

  @IsOptional()
  @IsArray()
  statusBases?: string[];

  @IsOptional()
  @IsNumber()
  limit?: number;
}

