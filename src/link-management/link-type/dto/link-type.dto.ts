import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PostType } from '../../../common/enum/post-type.enum';

export class CreateLinkTypeDto {
  @ApiProperty({ description: 'The name of the link type', example: 'Blocks' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Which work item this link type applies to',
    enum: PostType,
    example: PostType.TSK,
  })
  @IsEnum(PostType)
  @IsNotEmpty()
  postType: PostType;

  @ApiProperty({
    description: 'Explains the purpose and usage of the link type',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description:
      'Reciprocal label shown on the other item\'s detail view (e.g. "Depends On" for a "Blocks" type). Defaults to name when not set.',
    required: false,
  })
  @IsString()
  @IsOptional()
  targetName?: string;

  @ApiProperty({ description: 'The color of the link type', required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ description: 'The icon of the link type', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateLinkTypeDto {
  @ApiProperty({ description: 'The id of the link type', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: PostType, required: false })
  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  targetName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
