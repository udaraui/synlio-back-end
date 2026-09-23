import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { PostType } from '../../common/enum/post-type.enum';
import { AssigneeType } from '../../common/enum/assignee-type.enum';

export class CreateWorkLogDto {
  @IsInt()
  companyId: number;

  @IsInt()
  @IsOptional()
  divisionId?: number;

  @IsInt()
  postId: number;

  @IsString()
  postCode: string;

  @IsInt()
  @IsOptional()
  postEventId?: number;

  @IsEnum(PostType)
  postType: PostType;

  @IsInt()
  resourceId: number;

  @IsString()
  resourceName: string;

  @IsString()
  resourceEmail: string;

  @IsEnum(AssigneeType)
  resourceType: AssigneeType;

  @IsDateString()
  @IsOptional()
  startTimeDate?: Date;

  @IsDateString()
  @IsOptional()
  endTimeDate?: Date;

  @IsNumber()
  @IsOptional()
  effort?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateWorkLogDto {
  @IsInt()
  @IsOptional()
  companyId?: number;

  @IsInt()
  @IsOptional()
  divisionId?: number;

  @IsInt()
  @IsOptional()
  postId?: number;

  @IsString()
  @IsOptional()
  postCode?: string;

  @IsInt()
  @IsOptional()
  postEventId?: number;

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsInt()
  @IsOptional()
  resourceId?: number;

  @IsString()
  @IsOptional()
  resourceName?: string;

  @IsString()
  @IsOptional()
  resourceEmail?: string;

  @IsEnum(AssigneeType)
  @IsOptional()
  resourceType?: AssigneeType;

  @IsDateString()
  @IsOptional()
  startTimeDate?: Date;

  @IsDateString()
  @IsOptional()
  endTimeDate?: Date;

  @IsNumber()
  @IsOptional()
  effort?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
