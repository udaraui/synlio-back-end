import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TicketSpace } from '../ticket-space/ticket-space.entity';
import { Status } from '../../common/status/status.entity';
import { TicketSpaceStatusConfig } from '../ticket-space-status-config/ticket-space-status-config.entity';
import { TicketSpaceSeverityConfig } from '../ticket-space-severity-config/ticket-space-severity-config.entity';
import { TicketSpaceTypeConfig } from '../ticket-space-type-config/ticket-space-type-config.entity';
import { Division } from '../../company-management/division/division.entity';
import { Company } from '../../company-management/company/company.entity';
import { TicketImpact } from '../ticket-impact/ticket-impact.entity';
import { TicketSpaceMember } from '../ticket-space-member/ticket-space-member.entity';
import { TicketAttachment } from '../ticket-attachment/ticket-attachment.entity';
import { TicketQueue } from '../ticket-queue/ticket-queue.entity';
import { TicketEvent } from '../ticket-event/ticket-event.entity';

@Index('IDX_ticket_statusId_ticketSpaceId', ['statusId', 'ticketSpaceId'])
@Entity()
export class Ticket extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false, unique: true })
  code: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  /** Incremented by the BEFORE trigger (fn_ticket_version_manager) on every
   *  meaningful field change. Managed exclusively by the database – do not
   *  set this in application code. */
  @Column({ type: 'int', nullable: false, default: 0 })
  ticketVersion: number;

  // Ticket Space Relation
  @Column({ nullable: false })
  ticketSpaceId: number;

  @ManyToOne(() => TicketSpace)
  @JoinColumn({ name: 'ticketSpaceId' })
  ticketSpace: TicketSpace;

  // Denormalized Ticket Space
  @Column({ nullable: true })
  ticketSpaceName: string;

  @Column({ nullable: true })
  ticketSpacePrefix: string;

  // Company Relation
  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // Division Relation (space-level division)
  @Column({ nullable: true })
  divisionId: number;

  @ManyToOne(() => Division)
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  // Status Relation
  @Column({ nullable: true })
  statusId: number;

  @ManyToOne(() => TicketSpaceStatusConfig)
  @JoinColumn({ name: 'statusId' })
  status: TicketSpaceStatusConfig;

  // Denormalized Status
  @Column({ nullable: true })
  statusName: string;

  @Column({ nullable: true })
  statusColor: string;

  @Column({ nullable: true })
  statusBase: string;

  // Severity Relation
  @Column({ nullable: true })
  severityId: number;

  @ManyToOne(() => TicketSpaceSeverityConfig)
  @JoinColumn({ name: 'severityId' })
  severity: TicketSpaceSeverityConfig;

  // Denormalized Severity
  @Column({ nullable: true })
  severityName: string;

  @Column({ nullable: true })
  severityColor: string;

  // Ticket Type Relation
  @Column({ nullable: true })
  ticketTypeId: number;

  @ManyToOne(() => TicketSpaceTypeConfig)
  @JoinColumn({ name: 'ticketTypeId' })
  ticketType: TicketSpaceTypeConfig;

  // Denormalized Ticket Type
  @Column({ nullable: true })
  ticketTypeName: string;

  @Column({ nullable: true })
  ticketTypeIcon: string;

  // Department Relation
  @Column({ nullable: true })
  departmentId: number;

  @ManyToOne(() => Division)
  @JoinColumn({ name: 'departmentId' })
  department: Division;

  // Denormalized Department
  @Column({ nullable: true })
  departmentName: string;

  // Queue Relation
  @Column({ nullable: true })
  queueId: number;

  @ManyToOne(() => TicketQueue)
  @JoinColumn({ name: 'queueId' })
  queue: TicketQueue;

  // Denormalized Queue
  @Column({ nullable: true })
  queueName: string;

  // Impact Relation
  @Column({ nullable: true })
  impactId: number;

  @ManyToOne(() => TicketImpact)
  @JoinColumn({ name: 'impactId' })
  impact: TicketImpact;

  // Denormalized Impact
  @Column({ nullable: true })
  impactName: string;

  // Denormalized SLA
  @Column({ nullable: true })
  slaResponseTime: number;

  @Column({ nullable: true })
  slaResolutionTime: number;

  // Assignee Relation
  @Column({ nullable: true })
  assigneeId: number | null;

  @ManyToOne(() => TicketSpaceMember)
  @JoinColumn({ name: 'assigneeId' })
  assignee: TicketSpaceMember;

  // Denormalized Assignee
  @Column({ nullable: true })
  assigneeName: string;

  @Column({ nullable: true })
  assigneeProfilePicUrl: string;

  @Column({ nullable: true })
  assigneeEmail: string;

  // ── SLA Deadlines (pre-computed, stored) ─────────────────────────────────
  // Populated when ticketSlaId is set: createdAt + sla.responseTime minutes
  // Frozen (set to NULL) when ticket status base becomes 'Finished'
  @Column({ type: 'timestamptz', nullable: true })
  slaResponseDeadline: Date | null;

  // Populated when ticketSlaId is set: createdAt + sla.resolutionTime minutes
  // Frozen (set to NULL) when ticket status base becomes 'Finished'
  @Column({ type: 'timestamptz', nullable: true })
  slaResolutionDeadline: Date | null;

  // Effort fields
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  plannedEffort: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualEffort: number;

  // Completion Date
  @Column({ type: 'date', nullable: true })
  completionDate: Date;

  // Participants (Many-to-Many relation)
  @ManyToMany(() => TicketSpaceMember)
  @JoinTable({
    name: 'ticket_participants',
    joinColumn: { name: 'ticketId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'memberId', referencedColumnName: 'id' },
  })
  participants: TicketSpaceMember[];

  @OneToMany(() => TicketAttachment, (attachment) => attachment.ticket)
  ticketAttachments: TicketAttachment[];

  // ── Event log ─────────────────────────────────────────────────────────────
  /** Read-only – populated entirely by the ticket-event DB triggers. */
  @OneToMany(() => TicketEvent, (event) => event.ticket)
  ticketEvents: TicketEvent[];
}
