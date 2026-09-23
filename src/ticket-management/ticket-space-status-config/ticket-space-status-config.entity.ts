import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';

@Entity('ticket_space_status_config')
export class TicketSpaceStatusConfig extends BaseEntity {
  @Column()
  ticketSpaceId: number;

  @ManyToOne(() => TicketSpace, (space) => space.statusConfigs, {
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

  @Column({ type: 'enum', enum: StatusBaseEnum })
  base: StatusBaseEnum;

  @Column({ type: 'boolean', default: false })
  isPrimaryBase: boolean;
}
