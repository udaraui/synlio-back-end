import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActiveStatus } from '../../../common/enum/status.enum';
import { EmailProvider } from '../../../common/enum/email-provider.enum';
import { User } from '../../../user-management/user/user.entity';
import { BaseDto } from '../../../common/base/base.dto';
import { MeetingProvider } from '../../../meetings-integration/entities/meeting-integration-connection.entity';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'The name of the company',
    example: 'Company 1',
  })
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty({
    description: 'The code of the company',
    example: 'C1',
  })
  @IsString()
  @IsNotEmpty()
  company_code: string;

  @ApiProperty({
    description: 'The logo of the company',
    example: 'https://example.com/logo.png',
  })
  @IsString()
  @IsNotEmpty()
  logo: string;

  @ApiProperty({
    description: 'The suspend on date of the company',
    example: '2021-01-01',
  })
  @IsString()
  @IsNotEmpty()
  suspend_on: Date;

  @ApiProperty({
    description: 'The active status of the company',
    example: ActiveStatus.ACTIVE,
  })
  @IsString()
  @IsNotEmpty()
  isActive: ActiveStatus;

  @ApiProperty({
    description: 'The week end day (0-6)',
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  weekEndDay?: number;

  @ApiProperty({
    description: 'Notification sender email address',
    example: 'noreply@company.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  notificationEmail?: string;

  @ApiProperty({
    description: 'SMTP / mail provider',
    enum: EmailProvider,
    required: false,
  })
  @IsEnum(EmailProvider)
  @IsOptional()
  emailProvider?: EmailProvider;

  @ApiProperty({
    description: 'App password or API key for the mail provider',
    required: false,
  })
  @IsString()
  @IsOptional()
  notificationEmailPassword?: string;

  @ApiProperty({
    description: 'The users of the company',
    example: [1, 2, 3],
  })
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true }) // Indicates it's an array of numbers
  users: number[];
}

export class UpdateCompanyDto {
  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The name of the company',
    example: 'Company 1',
  })
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty({
    description: 'The code of the company',
    example: 'C1',
  })
  @IsString()
  @IsNotEmpty()
  company_code: string;

  @ApiProperty({
    description: 'The logo of the company',
    example: 'https://example.com/logo.png',
  })
  @IsString()
  @IsNotEmpty()
  logo: string;

  @ApiProperty({
    description: 'The suspend on date of the company',
    example: '2021-01-01',
  })
  @IsString()
  @IsNotEmpty()
  suspend_on: Date;

  @ApiProperty({
    description: 'The active status of the company',
    example: ActiveStatus.ACTIVE,
  })
  @IsString()
  @IsNotEmpty()
  isActive: ActiveStatus;

  @ApiProperty({
    description: 'Notification sender email address',
    example: 'noreply@company.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  notificationEmail?: string;

  @ApiProperty({
    description: 'SMTP / mail provider',
    enum: EmailProvider,
    required: false,
  })
  @IsEnum(EmailProvider)
  @IsOptional()
  emailProvider?: EmailProvider;

  @ApiProperty({
    description: 'App password or API key for the mail provider',
    required: false,
  })
  @IsString()
  @IsOptional()
  notificationEmailPassword?: string;

  @ApiProperty({
    description: 'The users of the company',
    example: [1, 2, 3],
  })
  @IsArray()
  @IsOptional()
  users: User[];
}

export class UpdateNotificationEmailDto {
  @ApiProperty({
    description: 'Notification sender email address',
    example: 'noreply@company.com',
  })
  @IsString()
  @IsNotEmpty()
  notificationEmail: string;

  @ApiProperty({
    description: 'SMTP / mail provider',
    enum: EmailProvider,
  })
  @IsEnum(EmailProvider)
  @IsNotEmpty()
  emailProvider: EmailProvider;

  @ApiProperty({
    description: 'App password or API key for the mail provider',
  })
  @IsString()
  @IsNotEmpty()
  notificationEmailPassword: string;
}

export class UpdateMeetingProvidersDto {
  @ApiProperty({
    description: 'Array of allowed meeting providers',
    example: ['teams', 'zoom'],
  })
  @IsArray()
  @IsEnum(MeetingProvider, { each: true })
  @IsOptional()
  allowedMeetingProviders: MeetingProvider[];
}

export class ResponseCompanyDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the company',
    example: 'Company 1',
  })
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty({
    description: 'The code of the company',
    example: 'C1',
  })
  @IsString()
  @IsNotEmpty()
  company_code: string;

  @ApiProperty({
    description: 'The logo of the company',
    example: 'https://example.com/logo.png',
  })
  @IsString()
  @IsOptional()
  logo: string;

  @ApiProperty({
    description: 'The suspend on date of the company',
    example: '2021-01-01',
  })
  @IsString()
  @IsOptional()
  suspend_on: Date;

  @ApiProperty({
    description: 'The active status of the company',
    example: ActiveStatus.ACTIVE,
  })
  @IsString()
  @IsNotEmpty()
  isActive: ActiveStatus;

  @ApiProperty({
    description: 'Notification sender email address',
    example: 'noreply@company.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  notificationEmail?: string;

  @ApiProperty({
    description: 'SMTP / mail provider',
    enum: EmailProvider,
    required: false,
  })
  @IsEnum(EmailProvider)
  @IsOptional()
  emailProvider?: EmailProvider;

  @ApiProperty({
    description: 'The users of the company',
    example: [1, 2, 3],
  })
  @IsArray()
  @IsOptional()
  users: User[];

  @ApiProperty({
    description: 'Array of allowed meeting providers',
    example: ['teams', 'zoom'],
  })
  @IsArray()
  @IsOptional()
  allowedMeetingProviders: MeetingProvider[];
}
