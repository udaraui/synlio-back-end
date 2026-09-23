import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CostRateType } from '../resource-cost.entity';
import { Calendar } from '../../calendar/calendar.entity';
import { ResourceSkill } from '../resource-skill.entity';
import { BaseDto } from '../../../common/base/base.dto';
import { Division } from '../../../company-management/division/division.entity';
import { Company } from '../../../company-management/company/company.entity';
import { ResourceType } from '../resource.entity';

export class ResourceCostDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @ApiProperty({ description: 'Cost amount', required: false })
  cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'Currency ID', required: false })
  currencyId?: number;

  @IsOptional()
  @IsEnum(CostRateType)
  @ApiProperty({
    description: 'Rate type: per_day or per_hour',
    enum: CostRateType,
    required: false,
  })
  rate_type?: CostRateType;
}

export class CreateResourceDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The first name of the resource' })
  first_name: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The last name of the resource' })
  last_name: string;

  @IsNotEmpty()
  @IsString()
  @IsEmail()
  @ApiProperty({ description: 'The email of the resource' })
  email: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The working hours of the resource' })
  working_hours: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The company id' })
  companyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The division id' })
  divisionId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The user id', required: false })
  userId: number;

  @IsOptional()
  @IsMobilePhone()
  @ApiProperty({
    description: 'The Mobile Phone Number of the resource',
    required: false,
  })
  mobile: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The profile picture of the resource',
    required: false,
  })
  profile_pic: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The calendar id', required: false })
  calendarId: number;

  @IsNotEmpty()
  @IsArray()
  @ApiProperty({ description: 'The skills of the resource' })
  skills: ResourceSkill[];

  @IsNotEmpty()
  @Type(() => Boolean)
  @IsBoolean()
  @ApiProperty({ description: 'The active status of the resource' })
  active_status: boolean;

  @IsOptional()
  @IsEnum(ResourceType)
  @ApiProperty({
    description: 'The type of the resource',
    enum: ResourceType,
    required: false,
    default: ResourceType.INTERNAL,
  })
  type?: ResourceType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The reporting person resource ID', required: false })
  reportingPersonId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResourceCostDto)
  @ApiProperty({ description: 'Optional cost information', required: false })
  resourceCost?: ResourceCostDto;
}

export class UpdateResourceDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The id of the resource' })
  id: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'The first name of the resource' })
  first_name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'The last name of the resource' })
  last_name: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  @ApiProperty({ description: 'The email of the resource' })
  email: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The working hours of the resource' })
  working_hours: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The company id' })
  companyId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The division id' })
  divisionId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The user id', required: false })
  userId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The calendar id' })
  calendarId: number;

  @IsOptional()
  @IsMobilePhone()
  @ApiProperty({
    description: 'The Mobile Phone Number of the resource',
    required: false,
  })
  mobile: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The profile picture of the resource',
    required: false,
  })
  profile_pic: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @ApiProperty({ description: 'The active status of the resource' })
  active_status: boolean;

  @IsOptional()
  @IsEnum(ResourceType)
  @ApiProperty({
    description: 'The type of the resource',
    enum: ResourceType,
    required: false,
  })
  type?: ResourceType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The reporting person resource ID', required: false })
  reportingPersonId?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @ApiProperty({ description: 'Update all resources reporting to the old person to report to this new person', required: false })
  update_all_under_old_reporting_person?: boolean;

  @IsOptional()
  @IsArray()
  @ApiProperty({ description: 'The skills of the resource' })
  skills: ResourceSkill[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ResourceCostDto)
  @ApiProperty({ description: 'Optional cost information', required: false })
  resourceCost?: ResourceCostDto;
}

export class ResponseResourceDto extends BaseDto {
  @ApiProperty({ description: 'The first name of the resource' })
  first_name: string;

  @ApiProperty({ description: 'The last name of the resource' })
  last_name: string;

  @ApiProperty({ description: 'The email of the resource' })
  email: string;

  @ApiProperty({ description: 'The working hours of the resource' })
  working_hours: number;

  @ApiProperty({
    description: 'The mobile phone number of the resource',
    required: false,
  })
  mobile: number;

  @ApiProperty({
    description: 'The profile picture of the resource',
    required: false,
  })
  profile_pic: string;

  @ApiProperty({ description: 'The company id' })
  company: Company;

  @ApiProperty({ description: 'The division id' })
  division: Division;

  @ApiProperty({ description: 'The user id' })
  userId: number;

  @ApiProperty({ description: 'The calendar id' })
  calendar: Calendar;

  // @ApiProperty({ description: 'The skills of the resource' })
  // @IsOptional()
  // skills: ResourceSkill[];

  @ApiProperty({ description: 'The active status of the resource' })
  active_status: boolean;

  @ApiProperty({ description: 'The type of the resource', enum: ResourceType })
  type: ResourceType;

  @ApiProperty({ description: 'The reporting person ID', required: false })
  reportingPersonId: number;

  @ApiProperty({ description: 'The reporting person resource details', required: false })
  reportingPerson: ResponseResourceDto;
}