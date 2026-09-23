import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PulseSnapshotStatus } from '../../common/enum/pulse-snapshot-status.enum';
import { CreatePulseDto } from './pulse.dto';
import { Type } from 'class-transformer';

export class CreatePulseWeekDto {
  @IsDate()
  weekStartDate: Date;

  @IsDate()
  weekEndDate: Date;

  @IsEnum(PulseSnapshotStatus)
  @IsOptional()
  status?: PulseSnapshotStatus;

  @IsDate()
  @IsOptional()
  submittedAt?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePulseDto)
  @IsOptional()
  pulses?: CreatePulseDto[];

  @IsNumber()
  userId: number;

  @IsString()
  userEmail: string;

  @IsString()
  userFullName: string;

  @IsString()
  @IsOptional()
  userProfilePicture?: string;

  @IsNumber()
  @IsOptional()
  synlioActivityTime?: number;

  @IsNumber()
  @IsOptional()
  meetingTime?: number;

  @IsNumber()
  @IsOptional()
  needAttentionCount?: number;

  @IsNumber()
  @IsOptional()
  taskFromMeetingCount?: number;

  @IsNumber()
  @IsOptional()
  missingTime?: number;

  @IsNumber()
  @IsOptional()
  submittedToId?: number;

  @IsNumber()
  @IsOptional()
  approvedById?: number;

  @IsString()
  @IsOptional()
  rejectReason?: string;

  @IsDate()
  @IsOptional()
  responsedAt?: Date;

  @IsString()
  @IsOptional()
  submittedToEmail?: string;

  @IsString()
  @IsOptional()
  submittedToFullName?: string;

  @IsString()
  @IsOptional()
  submittedToProfilePicture?: string;

  @IsString()
  @IsOptional()
  approvedByEmail?: string;

  @IsString()
  @IsOptional()
  approvedByFullName?: string;

  @IsString()
  @IsOptional()
  approvedByProfilePicture?: string;
}

export class UpdatePulseWeekDto {
  @IsDate()
  @IsOptional()
  weekStartDate?: Date;

  @IsDate()
  @IsOptional()
  weekEndDate?: Date;

  @IsEnum(PulseSnapshotStatus)
  @IsOptional()
  status?: PulseSnapshotStatus;

  @IsDate()
  @IsOptional()
  submittedAt?: Date;

  @IsNumber()
  @IsOptional()
  userId?: number;

  @IsString()
  @IsOptional()
  userEmail?: string;

  @IsString()
  @IsOptional()
  userFullName?: string;

  @IsString()
  @IsOptional()
  userProfilePicture?: string;

  @IsNumber()
  @IsOptional()
  synlioActivityTime?: number;

  @IsNumber()
  @IsOptional()
  meetingTime?: number;

  @IsNumber()
  @IsOptional()
  needAttentionCount?: number;

  @IsNumber()
  @IsOptional()
  taskFromMeetingCount?: number;

  @IsNumber()
  @IsOptional()
  missingTime?: number;

  @IsNumber()
  @IsOptional()
  submittedToId?: number;

  @IsNumber()
  @IsOptional()
  approvedById?: number;

  @IsString()
  @IsOptional()
  rejectReason?: string;

  @IsDate()
  @IsOptional()
  responsedAt?: Date;

  @IsString()
  @IsOptional()
  submittedToEmail?: string;

  @IsString()
  @IsOptional()
  submittedToFullName?: string;

  @IsString()
  @IsOptional()
  submittedToProfilePicture?: string;

  @IsString()
  @IsOptional()
  approvedByEmail?: string;

  @IsString()
  @IsOptional()
  approvedByFullName?: string;

  @IsString()
  @IsOptional()
  approvedByProfilePicture?: string;
}

export class SubmitPulseWeekDto {
  @IsNumber()
  submittedToId: number;
}

export class ForwardPulseWeekDto {
  @IsNumber()
  submittedToId: number;

  @IsString()
  @IsOptional()
  forwardMessage?: string;
}

export class ApprovePulseWeekDto {
  @IsNumber()
  @IsOptional()
  approvedById?: number;

  @IsString()
  @IsOptional()
  approvedByEmail?: string;
}

export class RejectPulseWeekDto {
  @IsString()
  rejectReason: string;
}