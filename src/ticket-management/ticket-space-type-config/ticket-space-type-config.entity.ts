import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';

@Entity('ticket_space_type_config')
export class TicketSpaceTypeConfig extends BaseEntity {
  @Column()
  ticketSpaceId: number;

  @ManyToOne(() => TicketSpace, (space) => space.typeConfigs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticketSpaceId' })
  ticketSpace: TicketSpace;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: '#6366f1' })
  color: string;

  @Column({ nullable: true })
  icon: string;
}
