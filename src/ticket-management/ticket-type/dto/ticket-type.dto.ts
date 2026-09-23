import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';
export class CreateTicketTypeDto {
  @ApiProperty({
    description: 'The name of the ticket type',
    example: 'Bug',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
  @ApiProperty({
    description: 'The color of the ticket type',
    example: '#ef4444',
  })
  @IsString()
  @IsNotEmpty()
  color: string;
  @ApiProperty({
    description: 'The icon of the ticket type',
    example: 'bug',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;
}
export class UpdateTicketTypeDto {
  @ApiProperty({
    description: 'The id of the ticket type',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;
  @ApiProperty({
    description: 'The name of the ticket type',
    example: 'Bug',
  })
  @IsString()
  @IsOptional()
  name?: string;
  @ApiProperty({
    description: 'The color of the ticket type',
    example: '#ef4444',
  })
  @IsString()
  @IsOptional()
  color?: string;
  @ApiProperty({
    description: 'The icon of the ticket type',
    example: 'bug',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;
}
export class ResponseTicketTypeDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the ticket type',
    example: 'Bug',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
  @ApiProperty({
    description: 'The color of the ticket type',
    example: '#ef4444',
  })
  @IsString()
  @IsNotEmpty()
  color: string;
  @ApiProperty({
    description: 'The icon of the ticket type',
    example: 'bug',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;
}
