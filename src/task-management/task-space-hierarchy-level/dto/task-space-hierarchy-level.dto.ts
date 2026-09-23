import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateTaskSpaceHierarchyLevelDto {
  @ApiProperty({
    description: 'Display order of this hierarchy level',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  sequence: number;

  @ApiProperty({
    description: 'Name of the hierarchy level',
    example: 'Epic',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Icon identifier for this hierarchy level',
    example: 'Folder',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Hex color code for this hierarchy level',
    example: '#6366f1',
    required: false,
  })
  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateTaskSpaceHierarchyLevelDto {
  @ApiProperty({
    description: 'ID of the hierarchy level to update',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'Display order of this hierarchy level',
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  sequence?: number;

  @ApiProperty({
    description: 'Name of the hierarchy level',
    example: 'Epic',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Icon identifier for this hierarchy level',
    example: 'Folder',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Hex color code for this hierarchy level',
    example: '#6366f1',
    required: false,
  })
  @IsString()
  @IsOptional()
  color?: string;
}

export class ResponseTaskSpaceHierarchyLevelDto extends BaseDto {
  @ApiProperty({
    description: 'Display order of this hierarchy level',
    example: 1,
  })
  sequence: number;

  @ApiProperty({
    description: 'Name of the hierarchy level',
    example: 'Epic',
  })
  name: string;

  @ApiProperty({
    description: 'Icon identifier for this hierarchy level',
    example: 'Folder',
  })
  icon: string;

  @ApiProperty({
    description: 'Hex color code for this hierarchy level',
    example: '#6366f1',
  })
  color: string;
}

