import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Company } from '../../../company-management/company/company.entity';
import { BaseDto } from '../../../common/base/base.dto';
import { Division } from '../../../company-management/division/division.entity';
import { User } from '../../../user-management/user/user.entity';
import { Resource } from '../../resource/resource.entity';

export class CreateResourcePool {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The name of the resource pool' })
  name: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The company id' })
  company: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The division id' })
  division?: Division;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The Pool Owner id' })
  pool_owner?: User;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The Resource id' })
  resources?: Resource;
}

export class UpdateResourcePoolDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The id of the resource pool' })
  id: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'The name of the resource pool' })
  name?: string;

  // Expecting ID for company update
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The ID of the company' })
  company?: number;

  // Expecting ID for division update
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The ID of the division' })
  division?: number;

  // Expecting an array of resource IDs to manage the ManyToMany relation
  @IsOptional()
  @IsArray()
  @ApiProperty({
    description: 'An array of Resource IDs to be associated with the pool',
  })
  resources?: number[];

  // Expecting ID for pool owner update
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ description: 'The ID of the Pool Owner' })
  pool_owner?: number;
}

export class ResponseResourcePoolDto extends BaseDto {
  @ApiProperty({ description: 'The name of the resource pool' })
  name: string;

  @ApiProperty({ description: 'The associated Company object' })
  company: Company;

  @ApiProperty({ description: 'The associated Division object' })
  division: Division;

  @ApiProperty({
    description: 'The resources associated with the pool',
    type: [Resource],
  })
  resources: Resource[];

  @ApiProperty({ description: 'The Pool Owner User object' })
  pool_owner: User;

  // Note: projectGroups is usually omitted or handled in a dedicated ProjectGroup endpoint
  // unless you specifically need the full list in the pool response.
}
