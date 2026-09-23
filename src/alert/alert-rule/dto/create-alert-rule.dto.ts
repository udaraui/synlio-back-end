import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAlertRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIn(['task', 'ticket'])
  spaceType: string;

  @IsNumber()
  @Type(() => Number)
  spaceId: number;

  /** Array of event enum string values, e.g. ["TASK_CREATED", "STATUS_CHANGED"] */
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsString()
  @IsIn(['in_app', 'email', 'both'])
  channel: string;

  // ── TO ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  toAssignee?: boolean;

  @IsOptional()
  @IsBoolean()
  toCoAssignees?: boolean;

  @IsOptional()
  @IsBoolean()
  toParticipants?: boolean;

  @IsOptional()
  @IsBoolean()
  toCreator?: boolean;

  @IsOptional()
  @IsBoolean()
  toActor?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  toAdditionalUserIds?: number[];

  // ── CC ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  ccAssignee?: boolean;

  @IsOptional()
  @IsBoolean()
  ccCoAssignees?: boolean;

  @IsOptional()
  @IsBoolean()
  ccParticipants?: boolean;

  @IsOptional()
  @IsBoolean()
  ccCreator?: boolean;

  @IsOptional()
  @IsBoolean()
  ccActor?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  ccAdditionalUserIds?: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
