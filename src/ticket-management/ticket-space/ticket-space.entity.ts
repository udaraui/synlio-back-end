import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Company } from '../../company-management/company/company.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';
import { TicketSpaceStatusConfig } from '../ticket-space-status-config/ticket-space-status-config.entity';
import { TicketSpaceSeverityConfig } from '../ticket-space-severity-config/ticket-space-severity-config.entity';
import { TicketSpaceTypeConfig } from '../ticket-space-type-config/ticket-space-type-config.entity';
import { TicketImpact } from '../ticket-impact/ticket-impact.entity';
import { Division } from '../../company-management/division/division.entity';
import { TicketSpaceMember } from '../ticket-space-member/ticket-space-member.entity';

@Entity('ticket_space')
export class TicketSpace extends BaseEntity {
  @Column()
  name: string;

  @Column()
  prefix: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  divisionId: number;

  @ManyToOne(() => Division)
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  @OneToMany(() => TicketSpaceStatusConfig, (config) => config.ticketSpace, {
    cascade: true,
  })
  statusConfigs: TicketSpaceStatusConfig[];

  @OneToMany(() => TicketSpaceSeverityConfig, (config) => config.ticketSpace, { cascade: true })
  severityConfigs: TicketSpaceSeverityConfig[];

  @OneToMany(() => TicketSpaceTypeConfig, (config) => config.ticketSpace, { cascade: true })
  typeConfigs: TicketSpaceTypeConfig[];

  @ManyToMany(() => TicketImpact)
  @JoinTable({
    name: 'ticket_space_impact',
    joinColumn: { name: 'ticketSpaceId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'ticketImpactId', referencedColumnName: 'id' },
  })
  ticketImpacts: TicketImpact[];

  @OneToMany(() => TicketSpaceMember, (member) => member.ticketSpace)
  members: TicketSpaceMember[];

  @ManyToMany(() => TicketQueue)
  @JoinTable({
    name: 'ticket_space_queue',
    joinColumn: { name: 'ticketSpaceId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'ticketQueueId', referencedColumnName: 'id' },
  })
  ticketQueues: TicketQueue[];
}
