import { IsString, IsNotEmpty, IsOptional, IsDateString, IsArray, IsInt, MaxLength } from 'class-validator';

export class CreateInternalMeetingDto {
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

  /** Array of user IDs to invite as attendees */
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  attendeeUserIds?: number[];
}
