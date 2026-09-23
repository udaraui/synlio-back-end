import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  IsInt,
  MaxLength,
} from 'class-validator';

export class UpdateInternalMeetingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** Full replacement list of attendee user IDs */
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  attendeeUserIds?: number[];
}
