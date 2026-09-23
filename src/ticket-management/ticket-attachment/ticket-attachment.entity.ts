import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Ticket } from '../ticket/ticket.entity';

@Entity()
export class TicketAttachment extends BaseEntity {
  @Column({ type: 'text', nullable: false })
  link: string;

  @Column({ nullable: false })
  ticketId: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.ticketAttachments, {
    nullable: false,
  })
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;
}
