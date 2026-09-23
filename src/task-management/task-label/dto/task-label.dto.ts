import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
export class CreateTmTaskLabelDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsNumber()
  @IsNotEmpty()
  taskSpaceId: number;
}
export class UpdateTmTaskLabelDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
export class AssignTmTaskLabelsDto {
  @IsNumber()
  @IsNotEmpty()
  taskId: number;
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  existingLabelIds?: number[];
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  newLabelNames?: string[];
}