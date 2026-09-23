import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTicketTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsNumber()
  @IsNotEmpty()
  ticketSpaceId: number;

  @IsObject()
  @IsNotEmpty()
  templateData: Record<string, any>;
}

export class UpdateTicketTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsObject()
  @IsOptional()
  templateData?: Record<string, any>;
}
