import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserConfigDto {
  @ApiProperty({
    description: 'The user ID',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'The theme preference',
    example: 'dark',
    required: false,
  })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({
    description: 'The user view preference',
    example: { global: 'card' },
    required: false,
  })
  @IsOptional()
  viewPreference?: any;

  @ApiProperty({
    description: 'The primary color preference',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({
    description: 'The sidebar color preference',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarColor?: string;

  @ApiProperty({
    description: 'The quick action configuration',
    example: [],
    required: false,
  })
  @IsOptional()
  quickActionConfig?: any;
}

export class UpdateUserConfigDto {
  @ApiProperty({
    description: 'The theme preference',
    example: 'dark',
    required: false,
  })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({
    description: 'The user view preference',
    example: { global: 'card' },
    required: false,
  })
  @IsOptional()
  viewPreference?: any;


  @ApiProperty({
    description: 'The user view preference',
    example: { global: 'card' },
    required: false,
  })
  @IsOptional()
  filterPreference?: any;

  @ApiProperty({
    description: 'The user saved filter templates',
    example: { ticket: [], task: [] },
    required: false,
  })
  @IsOptional()
  filterTemplates?: any;

  @ApiProperty({
    description: 'The primary color preference',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({
    description: 'The sidebar color preference',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarColor?: string;

  @ApiProperty({
    description: 'The quick action configuration',
    example: [],
    required: false,
  })
  @IsOptional()
  quickActionConfig?: any;
}

export class ResponseUserConfigDto {
  @ApiProperty({
    description: 'The user config ID',
    example: 1,
  })
  id?: number;

  @ApiProperty({
    description: 'The user ID',
    example: 1,
  })
  userId: number;

  @ApiProperty({
    description: 'The theme preference',
    example: 'dark',
  })
  theme: string;

  @ApiProperty({
    description: 'The user view preference',
    example: { global: 'card' },
  })
  viewPreference: any;

  @ApiProperty({
    description: 'The primary color preference',
    example: 'default',
  })
  primaryColor: string;

  @ApiProperty({
    description: 'The sidebar color preference',
    example: 'default',
  })
  sidebarColor: string;

  @ApiProperty({
    description: 'The user saved filter templates',
    example: { ticket: [], task: [] },
    required: false,
  })
  filterTemplates?: any;

  @ApiProperty({
    description: 'The quick action configuration',
    example: [],
    required: false,
  })
  quickActionConfig?: any;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt?: Date;
}
