import { IsString, IsOptional, IsEnum, IsInt, IsArray } from 'class-validator';
import { PostType } from '../../../common/enum/post-type.enum';

export class CreateCommentDto {
  @IsInt()
  @IsOptional()
  parentId?: number;

  @IsString()
  comment: string;

  @IsInt()
  postId: number;

  @IsEnum(PostType)
  postType: PostType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentLinks?: string[];
}

export class UpdateCommentDto {
  @IsInt()
  @IsOptional()
  parentId?: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsInt()
  @IsOptional()
  postId?: number;

  @IsEnum(PostType)
  @IsOptional()
  postType?: PostType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentLinks?: string[];
}
