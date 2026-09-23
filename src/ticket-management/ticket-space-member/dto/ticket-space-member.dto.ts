export class CreateTicketSpaceMemberDto {
  userId: number;

  queueIds?: number[]; // Array of queue IDs - optional for owners
}

export class UpdateTicketSpaceMemberDto {

  queueIds?: number[]; // Can update queues
}

export class ResponseTicketSpaceMemberDto {
  id?: number;
  ticketSpaceId?: number;
  userId?: number;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  userProfilePicture?: string;

  queues?: any[]; // Array of queue objects
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}
