import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  /** Duration in minutes (effort). Can be provided directly or auto-calculated from start/end */
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  /** Optionally link to a task at creation time */
  @IsInt()
  @IsOptional()
  taskId?: number;
}

export class LinkTaskToActivityDto {
  @IsInt()
  @IsNotEmpty()
  taskId: number;
}
