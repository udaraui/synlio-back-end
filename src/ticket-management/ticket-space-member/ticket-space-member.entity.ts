import {
  Entity,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';
import { User } from '../../user-management/user/user.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';

@Entity('ticket_space_member')
export class TicketSpaceMember extends BaseEntity {

  @Column()
  ticketSpaceId: number;

  @ManyToOne(() => TicketSpace, (ticketSpace) => ticketSpace.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticketSpaceId' })
  ticketSpace: TicketSpace;

  @Column()
  userId: number;

  @Column({ nullable: true })
  userFirstName?: string;

  @Column({ nullable: true })
  userLastName?: string;

  @Column({ nullable: true })
  userEmail?: string;

  @Column({ nullable: true })
  userProfilePicture?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Multiple queues support
  @ManyToMany(() => TicketQueue)
  @JoinTable({
    name: 'ticket_space_member_queue',
    joinColumn: { name: 'memberId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'queueId', referencedColumnName: 'id' },
  })
  queues: TicketQueue[];
}
