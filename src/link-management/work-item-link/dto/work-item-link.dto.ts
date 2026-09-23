import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PostType } from '../../../common/enum/post-type.enum';

export class CreateWorkItemLinkDto {
  @ApiProperty({ enum: PostType, example: PostType.TSK })
  @IsEnum(PostType)
  @IsNotEmpty()
  sourceType: PostType;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  sourceId: number;

  @ApiProperty({ enum: PostType, example: PostType.TKT })
  @IsEnum(PostType)
  @IsNotEmpty()
  targetType: PostType;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsNotEmpty()
  targetId: number;

  @ApiProperty({ description: 'Selected link type id (required)', example: 1 })
  @IsInt()
  @IsNotEmpty()
  linkTypeId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateWorkItemLinkDto {
  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  linkTypeId?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
