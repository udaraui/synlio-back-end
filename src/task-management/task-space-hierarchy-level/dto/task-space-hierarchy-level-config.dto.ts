import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** Sent when adding a hierarchy level to a task space */
export class AddHierarchyLevelConfigDto {
  @ApiProperty({ description: 'Display name of the level', example: 'Project' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Display order within this task space',
    example: 0,
  })
  @IsInt()
  @Min(0)
  sequence: number;

  @ApiProperty({
    description: 'Icon identifier',
    required: false,
    example: 'Folder',
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Hex color',
    required: false,
    example: '#6366f1',
  })
  @IsString()
  @IsOptional()
  color?: string;
}

/** Sent when updating an existing hierarchy-level config for a task space */
export class UpdateHierarchyLevelConfigDto {
  @ApiProperty({ description: 'Updated display order', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  sequence?: number;

  @ApiProperty({ description: 'Display name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Icon identifier', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ description: 'Hex color', required: false })
  @IsString()
  @IsOptional()
  color?: string;
}

/** Sent when adding a brand-new (space-only) hierarchy level that has no master record */
export class AddCustomHierarchyLevelConfigDto {
  @ApiProperty({ description: 'Display name of the custom level', example: 'Sprint' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Icon identifier', example: 'Folder', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ description: 'Hex color', example: '#6366f1', required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ description: 'Display order within the task space', example: 0 })
  @IsInt()
  @Min(0)
  sequence: number;
}
