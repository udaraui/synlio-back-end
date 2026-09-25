import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  FilterTemplateType,
  FilterTemplateVisibility,
} from '../filter-template.entity';

export class CreateFilterTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FilterTemplateType)
  type: FilterTemplateType;

  @IsEnum(FilterTemplateVisibility)
  @IsOptional()
  visibility?: FilterTemplateVisibility;

  @IsNotEmpty()
  filters: Record<string, any>;

  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  sharedUserIds?: number[];
}

export class UpdateFilterTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FilterTemplateVisibility)
  @IsOptional()
  visibility?: FilterTemplateVisibility;

  @IsOptional()
  filters?: Record<string, any>;

  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  sharedUserIds?: number[];
}

export class ShareFilterTemplateDto {
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[];

  @IsEnum(FilterTemplateVisibility)
  @IsOptional()
  visibility?: FilterTemplateVisibility;
}
