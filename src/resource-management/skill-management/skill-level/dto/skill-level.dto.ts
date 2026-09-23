import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SkillCategories } from '../../skill-category/skill-category.entity';
import { BaseDto } from '../../../../common/base/base.dto';

export class CreateSkillLevelDto {
  @ApiProperty({
    description: 'The name of the skill level',
    example: 'Intern',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The star count of the skill level',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  star_count: number;

  @ApiProperty({
    description: 'The category id of the skill level',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;
}

export class UpdateSkillLevelDto {
  @ApiProperty({
    description: 'The name of the skill level',
    example: 'Intern',
  })
  @IsOptional()
  @IsString()
  name?: string;
  @ApiProperty({
    description: 'The star count of the skill level',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  star_count?: number;
  @ApiProperty({
    description: 'The category id of the skill level',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  categoryId?: number;
  @ApiProperty({
    description: 'The is active of the skill level',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResponseSkillLevelDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the skill level',
    example: 'Intern',
  })
  @IsNotEmpty()
  @IsString()
  name: string;
  @ApiProperty({
    description: 'The star count of the skill level',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  star_count: number;
  @ApiProperty({
    description: 'The category id of the skill level',
    example: 1,
  })
  @IsNotEmpty()
  category: SkillCategories;
  @ApiProperty({
    description: 'The is active of the skill level',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}
