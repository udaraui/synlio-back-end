import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { BaseDto } from '../base/base.dto';
import { PostType } from '../enum/post-type.enum';
import { StatusBaseEnum } from '../enum/status-base.enum';

export class CreateStatusDto {
  @ApiProperty({
    description: 'The name of the status',
    example: 'In Progress',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The color of the status', example: '#3b82f6' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ description: 'The id of the company', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'The post type (Task or Ticket)',
    enum: PostType,
    required: false,
  })
  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType | null;

  @ApiProperty({
    description: 'The base classification of the status',
    enum: StatusBaseEnum,
    required: false,
  })
  @IsEnum(StatusBaseEnum)
  @IsOptional()
  base?: StatusBaseEnum | null;

  @ApiProperty({
    description: 'Whether the status is the primary status for its base',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimaryBase?: boolean | null;
}

export class UpdateStatusDto {
  @ApiProperty({ description: 'The id of the status', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The name of the status',
    example: 'In Progress',
  })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({ description: 'The color of the status', example: '#3b82f6' })
  @IsString()
  @IsOptional()
  color: string;

  @ApiProperty({ description: 'The id of the company', example: 1 })
  @IsNumber()
  @IsOptional()
  companyId: number;

  @ApiProperty({
    description: 'The post type (Task or Ticket)',
    enum: PostType,
    required: false,
  })
  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType | null;

  @ApiProperty({
    description: 'The base classification of the status',
    enum: StatusBaseEnum,
    required: false,
  })
  @IsEnum(StatusBaseEnum)
  @IsOptional()
  base?: StatusBaseEnum | null;

  @ApiProperty({
    description: 'Whether the status is the primary status for its base',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimaryBase?: boolean | null;
}

export class ResponseStatusDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the status',
    example: 'In Progress',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The color of the status', example: '#3b82f6' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ description: 'The id of the company', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'The post type (Task or Ticket)',
    enum: PostType,
    required: false,
  })
  postType?: PostType | null;

  @ApiProperty({
    description: 'The base classification of the status',
    enum: StatusBaseEnum,
    required: false,
  })
  base?: StatusBaseEnum | null;

  @ApiProperty({
    description: 'Whether the status is the primary status for its base',
    example: true,
    required: false,
  })
  isPrimaryBase?: boolean | null;
}
