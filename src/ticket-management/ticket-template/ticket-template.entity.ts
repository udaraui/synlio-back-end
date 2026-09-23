import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';

@Entity('ticket_template')
export class TicketTemplate extends BaseEntity {
  @Column()
  name: string;

  @Column({ default: false })
  isShared: boolean;

  @ManyToOne(() => TicketSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketSpaceId' })
  ticketSpace: TicketSpace;

  @Column()
  ticketSpaceId: number;

  @Column({ nullable: true })
  companyId: number;

  @Column({ type: 'jsonb' })
  templateData: Record<string, any>;
}
