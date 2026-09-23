import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateEmailDto {
  @ApiProperty({
    description: 'Sender email address',
    example: 'no-reply@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  to?: string;

  @ApiProperty({
    description: 'Comma-separated list of CC recipients',
    example: 'manager@example.com,lead@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  ccTo?: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Your task has been updated',
    required: false,
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({
    description: 'Email body as HTML text',
    example: '<p>Dear user, your task has been updated.</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Company ID associated with the email',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @ApiProperty({
    description: 'User ID of the recipient',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  userId?: number;

  @ApiProperty({
    description: 'Username of the recipient',
    example: 'john.doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: 'Base path / folder where attachments are stored',
    example: '/uploads/emails/2024/',
    required: false,
  })
  @IsString()
  @IsOptional()
  attachmentPath?: string;

  @ApiProperty({
    description: 'Whether the email has been sent',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isSent?: boolean;

  @ApiProperty({
    description: 'Expiry timestamp for the email',
    example: '2024-12-31T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiredAt?: string;

  @ApiProperty({
    description: 'URL or path to an image embedded in the email',
    example: '/uploads/banners/promo.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    description: 'Whether an error occurred while sending the email',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isError?: boolean;

  @ApiProperty({
    description: 'Error message if sending failed',
    example: 'SMTP connection timeout',
    required: false,
  })
  @IsString()
  @IsOptional()
  errorText?: string;

  @ApiProperty({
    description:
      'Space ID related to this email (e.g. ticket space or project space)',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  spaceId?: number;
}

export class UpdateEmailDto {
  @ApiProperty({
    description: 'ID of the email record to update',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'Sender email address',
    example: 'no-reply@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  to?: string;

  @ApiProperty({
    description: 'Comma-separated list of CC recipients',
    example: 'manager@example.com,lead@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  ccTo?: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Your task has been updated',
    required: false,
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({
    description: 'Email body as HTML text',
    example: '<p>Dear user, your task has been updated.</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Company ID associated with the email',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @ApiProperty({
    description: 'User ID of the recipient',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  userId?: number;

  @ApiProperty({
    description: 'Username of the recipient',
    example: 'john.doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: 'Base path / folder where attachments are stored',
    example: '/uploads/emails/2024/',
    required: false,
  })
  @IsString()
  @IsOptional()
  attachmentPath?: string;

  @ApiProperty({
    description: 'Whether the email has been sent',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isSent?: boolean;

  @ApiProperty({
    description: 'Expiry timestamp for the email',
    example: '2024-12-31T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiredAt?: string;

  @ApiProperty({
    description: 'URL or path to an image embedded in the email',
    example: '/uploads/banners/promo.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    description: 'Whether an error occurred while sending the email',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isError?: boolean;

  @ApiProperty({
    description: 'Error message if sending failed',
    example: 'SMTP connection timeout',
    required: false,
  })
  @IsString()
  @IsOptional()
  errorText?: string;

  @ApiProperty({
    description: 'Space ID related to this email',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  spaceId?: number;
}

export class ResponseEmailDto extends BaseDto {
  @ApiProperty({
    description: 'Sender email address',
    example: 'no-reply@example.com',
  })
  from: string;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  to: string;

  @ApiProperty({
    description: 'Comma-separated list of CC recipients',
    example: 'manager@example.com,lead@example.com',
  })
  ccTo: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Your task has been updated',
  })
  subject: string;

  @ApiProperty({
    description: 'Email body as HTML text',
    example: '<p>Dear user, your task has been updated.</p>',
  })
  description: string;

  @ApiProperty({
    description: 'Company ID',
    example: 1,
  })
  companyId: number;

  @ApiProperty({
    description: 'Company details',
  })
  company?: any;

  @ApiProperty({
    description: 'User ID of the recipient',
    example: 1,
  })
  userId: number;

  @ApiProperty({
    description: 'Username of the recipient',
    example: 'john.doe',
  })
  username: string;

  @ApiProperty({
    description: 'User details',
  })
  user?: any;

  @ApiProperty({
    description: 'Base path / folder where attachments are stored',
    example: '/uploads/emails/2024/',
  })
  attachmentPath: string;

  @ApiProperty({
    description: 'List of email attachments',
    type: [Object],
  })
  attachments?: any[];

  @ApiProperty({
    description: 'Whether the email has been sent',
    example: false,
  })
  isSent: boolean;

  @ApiProperty({
    description: 'Expiry timestamp for the email',
    example: '2024-12-31T23:59:59.000Z',
  })
  expiredAt: Date;

  @ApiProperty({
    description: 'URL or path to an image embedded in the email',
    example: '/uploads/banners/promo.png',
  })
  image: string;

  @ApiProperty({
    description: 'Whether an error occurred while sending the email',
    example: false,
  })
  isError: boolean;

  @ApiProperty({
    description: 'Error message if sending failed',
    example: 'SMTP connection timeout',
  })
  errorText: string;

  @ApiProperty({
    description: 'Space ID related to this email',
    example: 1,
  })
  spaceId: number;
}
