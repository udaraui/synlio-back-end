import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { IsString } from 'class-validator';
import { IsEmail } from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';
import { Division } from '../../../company-management/division/division.entity';
import { Company } from '../../../company-management/company/company.entity';

export class CreateUserDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  first_name: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsNotEmpty()
  @IsString()
  last_name: string;

  @ApiProperty({
    description: 'The mobile number of the user',
    example: '0771234567',
  })
  @IsNotEmpty()
  @IsString()
  phone_number: string;
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'password',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  password: string;

  @ApiProperty({
    description: 'The profile picture of the user',
    example: 'profile.jpg',
  })
  @IsOptional()
  @IsString()
  profile_picture: string;

  @ApiProperty({
    description: 'The is active of the user',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'The user company roles of the user',
    example: [
      { companyId: 1, roleId: 1 },
      { companyId: 2, roleId: 2 },
    ],
  })
  @IsOptional()
  @IsArray()
  userCompanyRoles: { companyId: number; roleId: number }[];

  @ApiProperty({
    description: 'The companies of the user',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  companyIds: number[];

  @ApiProperty({
    description: 'The divisions of the user',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  divisionIds: number[];
}

export class UpdateUserDto {
  @ApiProperty({
    description: 'The id of the user',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  first_name: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  last_name: string;

  @ApiProperty({
    description: 'The mobile number of the user',
    example: '0771234567',
  })
  @IsOptional()
  @IsString()
  mobile_number: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'The profile picture of the user',
    example: 'profile.jpg',
  })
  @IsOptional()
  @IsString()
  profile_picture: string;

  @ApiProperty({
    description: 'The is active of the user',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'The user company roles of the user',
    example: [
      { companyId: 1, roleId: 1 },
      { companyId: 2, roleId: 2 },
    ],
  })
  @IsOptional()
  @IsArray()
  userCompanyRoles: { companyId: number; roleId: number }[];

  @ApiProperty({
    description: 'The companies of the user',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  companies: number[];

  @ApiProperty({
    description: 'The divisions of the user',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  divisions: number[];
}

export class ResponseUserDto extends BaseDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  first_name: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsNotEmpty()
  @IsString()
  last_name: string;

  @ApiProperty({
    description: 'The mobile number of the user',
    example: '0771234567',
  })
  @IsNotEmpty()
  @IsString()
  mobile_number: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'The profile picture of the user',
    example: 'profile.jpg',
  })
  @IsNotEmpty()
  @IsString()
  profile_picture: string;

  @ApiProperty({
    description: 'The companies of the user',
    example: [1, 2, 3],
  })
  @IsNotEmpty()
  @IsArray()
  companies: Company[];

  @ApiProperty({
    description: 'The divisions of the user',
    example: [1, 2, 3],
  })
  @IsNotEmpty()
  @IsArray()
  divisions: Division[];

  @ApiProperty({
    description: 'The user company roles of the user',
    example: [
      { companyId: 1, roleId: 1 },
      { companyId: 2, roleId: 2 },
    ],
  })
  @IsNotEmpty()
  @IsArray()
  userCompanyRoles: { companyId: number; roleId: number }[];

  @ApiProperty({
    description: 'The is active of the user',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}
