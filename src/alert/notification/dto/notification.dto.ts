import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Sender identifier (email, username, or system label)',
    example: 'system@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({
    description: 'Recipient identifier (email, username, or user label)',
    example: 'user@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  to?: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Task Assigned',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Notification body as HTML text',
    example: '<p>You have been assigned a new task.</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Company ID associated with the notification',
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
    example: '/uploads/notifications/2024/',
    required: false,
  })
  @IsString()
  @IsOptional()
  attachmentPath?: string;

  @ApiProperty({
    description: 'Whether the notification has been sent',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isSent?: boolean;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @ApiProperty({
    description: 'ID of the referenced entity (e.g. ticket id)',
    example: 42,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  referenceId?: number;

  @ApiProperty({
    description: 'Type of the referenced entity (e.g. ticket)',
    example: 'ticket',
    required: false,
  })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiProperty({
    description: 'Space / context ID for the reference (e.g. ticketSpaceId)',
    example: 3,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  referenceSpaceId?: number;
}

export class UpdateNotificationDto {
  @ApiProperty({
    description: 'ID of the notification to update',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'Sender identifier',
    example: 'system@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({
    description: 'Recipient identifier',
    example: 'user@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  to?: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Task Assigned',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Notification body as HTML text',
    example: '<p>You have been assigned a new task.</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Company ID associated with the notification',
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
    example: '/uploads/notifications/2024/',
    required: false,
  })
  @IsString()
  @IsOptional()
  attachmentPath?: string;

  @ApiProperty({
    description: 'Whether the notification has been sent',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isSent?: boolean;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @ApiProperty({
    description: 'ID of the referenced entity (e.g. ticket id)',
    example: 42,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  referenceId?: number;

  @ApiProperty({
    description: 'Type of the referenced entity (e.g. ticket)',
    example: 'ticket',
    required: false,
  })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiProperty({
    description: 'Space / context ID for the reference (e.g. ticketSpaceId)',
    example: 3,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  referenceSpaceId?: number;
}

export class ResponseNotificationDto extends BaseDto {
  @ApiProperty({
    description: 'Sender identifier',
    example: 'system@example.com',
  })
  from: string;

  @ApiProperty({
    description: 'Recipient identifier',
    example: 'user@example.com',
  })
  to: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Task Assigned',
  })
  title: string;

  @ApiProperty({
    description: 'Notification body as HTML text',
    example: '<p>You have been assigned a new task.</p>',
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
    example: '/uploads/notifications/2024/',
  })
  attachmentPath: string;

  @ApiProperty({
    description: 'List of notification attachments',
    type: [Object],
  })
  attachments?: any[];

  @ApiProperty({
    description: 'Whether the notification has been sent',
    example: false,
  })
  isSent: boolean;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  isRead: boolean;

  @ApiProperty({
    description: 'ID of the referenced entity',
    example: 42,
  })
  referenceId?: number;

  @ApiProperty({
    description: 'Type of the referenced entity',
    example: 'ticket',
  })
  referenceType?: string;

  @ApiProperty({
    description: 'Space / context ID for the reference (e.g. ticketSpaceId)',
    example: 3,
  })
  referenceSpaceId?: number;
}
