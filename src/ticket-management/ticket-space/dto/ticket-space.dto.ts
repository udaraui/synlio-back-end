import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsArray,
} from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateTicketSpaceDto {
  @ApiProperty({
    description: 'The name of the ticket space',
    example: 'Customer Support Space',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The prefix for tickets in this space (unique per company)',
    example: 'CS',
  })
  @IsString()
  @IsNotEmpty()
  prefix: string;

  @ApiProperty({
    description: 'The description of the ticket space',
    example: 'Space for handling customer support tickets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'The id of the division',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  divisionId: number;

  @ApiProperty({
    description: 'Array of ticket queue IDs',
    example: [1],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketQueueIds?: number[];

  @ApiProperty({
    description: 'Array of status IDs',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketStatusIds?: number[];

  @ApiProperty({
    description: 'Array of severity IDs',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketSeverityIds?: number[];

  @ApiProperty({
    description: 'Array of ticket type IDs',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketTypeIds?: number[];

  @ApiProperty({
    description: 'Array of ticket SLA IDs',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketSlaIds?: number[];

  @ApiProperty({
    description: 'Array of ticket impact IDs',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketImpactIds?: number[];
}

export class UpdateTicketSpaceDto {
  @ApiProperty({
    description: 'The id of the ticket space',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The name of the ticket space',
    example: 'Customer Support Space',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The prefix for tickets in this space (unique per company)',
    example: 'CS',
  })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiProperty({
    description: 'The description of the ticket space',
    example: 'Space for handling customer support tickets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @ApiProperty({
    description: 'The id of the division',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  divisionId?: number;

  @ApiProperty({
    description: 'Array of ticket queue IDs',
    example: [1],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketQueueIds?: number[];

  @ApiProperty({
    description: 'Array of status IDs',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketStatusIds?: number[];

  @ApiProperty({
    description: 'Array of severity IDs',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketSeverityIds?: number[];

  @ApiProperty({
    description: 'Array of ticket type IDs',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketTypeIds?: number[];

  @ApiProperty({
    description: 'Array of ticket SLA IDs',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketSlaIds?: number[];

  @ApiProperty({
    description: 'Array of ticket impact IDs',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsOptional()
  ticketImpactIds?: number[];
}

export class ResponseTicketSpaceDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the ticket space',
    example: 'Customer Support Space',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The prefix for tickets in this space',
    example: 'CS',
  })
  @IsString()
  @IsNotEmpty()
  prefix: string;

  @ApiProperty({
    description: 'The description of the ticket space',
    example: 'Space for handling customer support tickets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'The id of the company',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'The id of the division',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  divisionId: number;
}
