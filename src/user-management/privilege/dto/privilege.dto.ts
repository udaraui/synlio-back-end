import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '../../role/role.entity';

export class CreatePrivilegeDto {
  @IsString()
  @IsNotEmpty()
  privilege: string;

  @IsString()
  @IsNotEmpty()
  access_key: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdatePrivilegeDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  privilege: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsString()
  @IsNotEmpty()
  access_key: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ResponsePrivilegeDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  privilege: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsString()
  @IsNotEmpty()
  access_key: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsOptional()
  roles: Role[];
}
