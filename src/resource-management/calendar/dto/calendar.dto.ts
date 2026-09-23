import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { CalendarDays } from '../calendar-days.entity';
import { BaseDto } from '../../../common/base/base.dto';
import { Company } from '../../../company-management/company/company.entity';

export class CreateCalendarDto {
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ description: 'The company id' })
  companyId: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The name of the calendar' })
  name: string;

  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({
    description:
      'First date of the first week of the calendar year (yyyy-MM-dd). ' +
      'Every generated week starts on this weekday.',
  })
  yearStartDate: string;
}

export class UpdateCalendarDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The name of the calendar' })
  name: string;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({ description: 'The status of the calendar' })
  isActive: boolean;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    required: false,
    description:
      'New year start date (yyyy-MM-dd). Only accepted while the calendar is ' +
      'still unconfigured; the days are regenerated around the new week.',
  })
  yearStartDate?: string;
}

export class WeekConfigDto {
  @ApiProperty({ description: 'First date of week 1', nullable: true })
  yearStartDate: string | null;

  @ApiProperty({ description: 'How many years the calendar currently covers' })
  yearCount: number;

  @ApiProperty({
    description: 'First date of every year the calendar covers, oldest first',
    type: [String],
  })
  yearStarts: string[];

  @ApiProperty({
    description: 'First date of the year running today',
    nullable: true,
  })
  currentYearStartDate: string | null;

  @ApiProperty({ description: 'Whether the year start date can still change' })
  isEditable: boolean;

  @ApiProperty({
    description: 'Reasons the year start date is locked, empty when editable',
    type: [String],
  })
  blockers: string[];

  @ApiProperty({ description: 'Last generated day', nullable: true })
  lastDate: string | null;

  @ApiProperty({ description: 'Year an extension would add', nullable: true })
  nextYear: number | null;

  @ApiProperty({ description: 'First date of that year', nullable: true })
  nextYearStartDate: string | null;

  @ApiProperty({ description: 'Last date of that year', nullable: true })
  nextYearEndDate: string | null;

  @ApiProperty({ description: 'Weeks that year would hold', nullable: true })
  nextYearWeeks: number | null;

  @ApiProperty({
    description: 'How many weekdays the repeated holiday pattern covers',
  })
  repeatedHolidayCount: number;
}

export class ResponseCalendarDto extends BaseDto {
  @ApiProperty({ description: 'The name of the calendar' })
  name: string;

  @ApiProperty({ description: 'The status of the calendar' })
  isActive: boolean;

  @ApiProperty({ description: 'The company id' })
  company: Company;

  @ApiProperty({ description: 'The calendar days' })
  calendarDays: CalendarDays[];
}
