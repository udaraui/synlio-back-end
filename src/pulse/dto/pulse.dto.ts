import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
} from 'class-validator';
import { PulseType } from '../../common/enum/pulse-type.enum';
import { PostType } from '../../common/enum/post-type.enum';
import { AssigneeType } from '../../common/enum/assignee-type.enum';
import { PulseSnapshotStatus } from '../../common/enum/pulse-snapshot-status.enum';

export class CreatePulseDto {
  @IsNumber()
  companyId: number;

  @IsEnum(PulseType)
  pulseType: PulseType;

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsNumber()
  @IsOptional()
  postId?: number;

  @IsString()
  @IsOptional()
  postCode?: string;

  @IsString()
  @IsOptional()
  postName?: string;

  @IsNumber()
  @IsOptional()
  postSpaceId?: number;

  @IsString()
  @IsOptional()
  postSpaceName?: string;

  @IsEnum(AssigneeType)
  resourceType: AssigneeType;

  @IsString()
  @IsOptional()
  pulseSummary?: string;

  @IsString()
  @IsOptional()
  attentionConditions?: string;

  @IsString()
  @IsOptional()
  meetingType?: string;

  @IsNumber()
  @IsOptional()
  allocatedHours?: number;

  @IsEnum(PulseSnapshotStatus)
  pulseSnapshotStatus: PulseSnapshotStatus;

  @IsDate()
  @IsOptional()
  submittedAt?: Date;
}

export class UpdatePulseDto {
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @IsEnum(PulseType)
  @IsOptional()
  pulseType?: PulseType;

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsNumber()
  @IsOptional()
  postId?: number;

  @IsString()
  @IsOptional()
  postCode?: string;

  @IsString()
  @IsOptional()
  postName?: string;

  @IsNumber()
  @IsOptional()
  postSpaceId?: number;

  @IsString()
  @IsOptional()
  postSpaceName?: string;

  @IsEnum(AssigneeType)
  @IsOptional()
  resourceType?: AssigneeType;

  @IsString()
  @IsOptional()
  pulseSummary?: string;

  @IsString()
  @IsOptional()
  attentionConditions?: string;

  @IsString()
  @IsOptional()
  meetingType?: string;

  @IsNumber()
  @IsOptional()
  allocatedHours?: number;

  @IsEnum(PulseSnapshotStatus)
  @IsOptional()
  pulseSnapshotStatus?: PulseSnapshotStatus;

  @IsDate()
  @IsOptional()
  submittedAt?: Date;
}
