import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Ticket } from '../ticket/ticket.entity';

// ============================================================================
// TicketEvent – audit log for ticket lifecycle changes
// ============================================================================
// Populated entirely by PostgreSQL triggers (fn_ticket_event_logger,
// fn_ticket_attachment_event_logger, fn_ticket_participant_event_logger).
// Application code should treat this table as read-only.
//
// event_type values
// ─────────────────────────────────────────────────────────────────────────────
// TICKET_CREATED              – ticket row inserted
// TICKET_UPDATED              – one or more tracked fields changed:
//                               name, description, statusId, assigneeId,
//                               severityId, ticketTypeId, queueId,
//                               plannedEffort, actualEffort
// TICKET_ATTACHMENT_UPLOADED  – row inserted into ticket_attachment
// TICKET_ATTACHMENT_DELETED   – row deleted from ticket_attachment
// TICKET_PARTICIPANT_ADDED    – row inserted into ticket_participants
// TICKET_PARTICIPANT_REMOVED  – row deleted from ticket_participants
// ============================================================================
@Entity('ticket_event')
export class TicketEvent extends BaseEntity {
  // ── Relation ───────────────────────────────────────────────────────────────

  @Column({ nullable: false })
  ticketId: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.ticketEvents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  // ── Event metadata ─────────────────────────────────────────────────────────

  /** One of the TICKET_* constants listed above. */
  @Column({ type: 'varchar', nullable: false })
  eventType: string;

  /**
   * ticketVersion snapshot at the time of the event.
   * Incremented by fn_ticket_version_manager on every meaningful core-field change.
   * For attachment/participant events the value reflects the current ticketVersion
   * without incrementing it.
   */
  @Column({ type: 'int', nullable: false, default: 0 })
  version: number;

  /**
   * Who triggered the event (createdBy / updatedBy from the changed row,
   * or the ticket's updatedBy for join-table events).
   */
  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  /** UUID for correlating events that belong to the same logical operation. */
  @Column({ type: 'uuid', nullable: true })
  correlationId: string | null;

  /**
   * Event payload.
   * • TICKET_CREATED              – full row snapshot (minus ticketVersion)
   * • TICKET_UPDATED              – { field: { from, to } } for each changed field
   * • TICKET_ATTACHMENT_UPLOADED / DELETED – { attachmentId, link }
   * • TICKET_PARTICIPANT_ADDED / REMOVED   – { permissionId }
   */
  @Column({ type: 'jsonb', default: {}, nullable: false })
  payload: Record<string, any>;

  /** Wall-clock timestamp set by the trigger (not by the application). */
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;
}
