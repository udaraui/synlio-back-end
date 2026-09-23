import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';

@Entity()
@Index('IDX_ticket_impact_space_name_unique', ['ticketSpaceId', 'name'], {
  unique: true,
})
export class TicketImpact extends BaseEntity {
  @Column({ nullable: false })
  ticketSpaceId: number;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description: string;
}
