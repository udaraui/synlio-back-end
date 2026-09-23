import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateDivisionDto {
  @ApiProperty({
    description: 'The name of the division',
    example: 'Sales',
  })
  @IsString()
  @IsNotEmpty()
  division: string;

  @ApiProperty({
    description: 'The code of the division',
    example: 'SALES',
  })
  @IsString()
  @IsNotEmpty()
  division_code: string;

  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'The status of the division',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive: boolean;
}

export class UpdateDivisionDto {
  @ApiProperty({
    description: 'The id of the division',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The name of the division',
    example: 'Sales',
  })
  @IsString()
  @IsOptional()
  division: string;

  @ApiProperty({
    description: 'The code of the division',
    example: 'SALES',
  })
  @IsString()
  @IsOptional()
  division_code: string;

  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  companyId: number;

  @ApiProperty({
    description: 'The status of the division',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive: boolean;
}

export class ResponseDivisionDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the division',
    example: 'Sales',
  })
  @IsString()
  @IsNotEmpty()
  division: string;

  @ApiProperty({
    description: 'The code of the division',
    example: 'SALES',
  })
  @IsString()
  @IsNotEmpty()
  division_code: string;

  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'The status of the division',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
