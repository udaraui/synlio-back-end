import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateTicketQueueDto {
  @ApiProperty({
    description: 'The name of the ticket queue',
    example: 'IT Support',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The description of the ticket queue',
    example: 'Queue for IT support tickets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTicketQueueDto {
  @ApiProperty({
    description: 'The id of the ticket queue',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The name of the ticket queue',
    example: 'IT Support',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The description of the ticket queue',
    example: 'Queue for IT support tickets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class ResponseTicketQueueDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the ticket queue',
    example: 'IT Support',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The description of the ticket queue',
    example: 'Queue for IT support tickets',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
