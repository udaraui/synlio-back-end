import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { BaseDto } from '../../../../common/base/base.dto';

export class CreateSkillDto {
  @ApiProperty({
    description: 'The name of the skill',
    example: 'Skill 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The category id of the skill',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;
}

export class UpdateSkillDto {
  @ApiProperty({
    description: 'The id of the skill',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'The name of the skill',
    example: 'Skill 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The category id of the skill',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;

  @ApiProperty({
    description: 'The active status of the skill',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}

export class ResponseSkillDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the skill',
    example: 'Skill 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The category id of the skill',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;
}
