import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';
import { BaseDto } from '../../../common/base/base.dto';

export class CreateTicketImpactDto {
  @ApiProperty({
    description: 'The name of the ticket impact',
    example: 'High',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The description of the ticket impact',
    example: 'Affects multiple users or critical business functions',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTicketImpactDto {
  @ApiProperty({
    description: 'The id of the ticket impact',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'The name of the ticket impact',
    example: 'High',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The description of the ticket impact',
    example: 'Affects multiple users or critical business functions',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class ResponseTicketImpactDto extends BaseDto {
  @ApiProperty({
    description: 'The name of the ticket impact',
    example: 'High',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The description of the ticket impact',
    example: 'Affects multiple users or critical business functions',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
