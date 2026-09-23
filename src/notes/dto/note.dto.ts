import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateNoteDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class ShareNoteDto {
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[];
}
