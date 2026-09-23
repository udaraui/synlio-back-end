import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsArray,
} from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateTaskSpaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  prefix: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @IsNumber()
  @IsOptional()
  divisionId?: number;

  @IsArray()
  @IsOptional()
  hierarchyLevelIds?: number[];

  @IsArray()
  @IsOptional()
  ownerIds?: number[];

  @IsArray()
  @IsOptional()
  resourceIds?: number[];
}

export class UpdateTaskSpaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  prefix?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsNumber()
  @IsOptional()
  divisionId?: number;

  @IsArray()
  @IsOptional()
  hierarchyLevelIds?: number[];

  @IsArray()
  @IsOptional()
  ownerIds?: number[];

  @IsArray()
  @IsOptional()
  resourceIds?: number[];
}

export class ResponseTaskSpaceDto extends BaseDto {
  name: string;
  prefix: string;
  description: string;
  companyId: number;
  divisionId: number;
}
