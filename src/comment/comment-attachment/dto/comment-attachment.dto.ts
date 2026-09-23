import { IsString, IsInt } from 'class-validator';

export class CreateCommentAttachmentDto {
  @IsString()
  link: string;

  @IsInt()
  commentId: number;
}

export class UpdateCommentAttachmentDto {
  @IsString()
  link: string;
}
