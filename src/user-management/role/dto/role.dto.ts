import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';
import { Privilege } from '../../privilege/privilege.entity';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  role: string;


  @IsNumber()
  @IsOptional()
  companyId?: number;
}

export class UpdateRoleDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

}

export class ResponseRoleDto extends BaseDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;


  @IsArray()
  @IsOptional()
  privileges: Privilege[];
}
