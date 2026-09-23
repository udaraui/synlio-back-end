import { ApiProperty } from '@nestjs/swagger';

export abstract class BaseDto {
  @ApiProperty()
  id?: number;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;

  @ApiProperty()
  createdBy?: string;

  @ApiProperty()
  updatedBy?: string;
}
