import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseDto } from '../base/base.dto';
import { PostType } from '../enum/post-type.enum';

export class CreateSeverityDto {
  @ApiProperty({ description: 'The name of the severity', example: 'Critical' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The color of the severity', example: '#ef4444' })
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
}

export class UpdateSeverityDto {
  @ApiProperty({ description: 'The id of the severity', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({ description: 'The name of the severity', example: 'Critical' })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({ description: 'The color of the severity', example: '#ef4444' })
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
}

export class ResponseSeverityDto extends BaseDto {
  @ApiProperty({ description: 'The name of the severity', example: 'Critical' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The color of the severity', example: '#ef4444' })
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
}
