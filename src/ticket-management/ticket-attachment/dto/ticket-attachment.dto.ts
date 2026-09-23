import { IsString, IsInt } from 'class-validator';

export class CreateTicketAttachmentDto {
  @IsString()
  link: string;

  @IsInt()
  ticketId: number;
}

export class UpdateTicketAttachmentDto {
  @IsString()
  link: string;
}
