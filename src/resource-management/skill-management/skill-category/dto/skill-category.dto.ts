import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { BaseDto } from '../../../../common/base/base.dto';

export class CreateSkillCategoryDto {
  @ApiProperty({
    description: 'The name of the skill category',
    example: 'Skill Category 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The description of the skill category',
    example: 'Skill Category 1 description',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'The company id of the skill category',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  companyId: number;

  @ApiProperty({
    description: 'The active status of the skill category',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  active_status: boolean;
}

export class UpdateSkillCategoryDto {
  @ApiProperty({
    description: 'The id of the skill category',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'The name of the skill category',
    example: 'Skill Category 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The description of the skill category',
    example: 'Skill Category 1 description',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'The active status of the skill category',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'The company id of the skill category',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  companyId: number;
}

export class ResponseSkillCategoryDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the skill category',
    example: 'Skill Category 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The description of the skill category',
    example: 'Skill Category 1 description',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'The company id of the skill category',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  companyId: number;
}
