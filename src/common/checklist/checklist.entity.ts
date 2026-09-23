import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base/base.entity';

/** Which kind of work item a checklist row hangs off. */
export type ChecklistEntityType = 'Task' | 'Ticket';

/**
 * A checklist row shared by tasks and tickets.
 *
 * `entityId` and `assigneeId` are polymorphic and therefore carry no foreign
 * keys — `entityType` decides what they point at:
 *   • Task   → entityId = tm_task.id,  assigneeId = resource.id
 *   • Ticket → entityId = ticket.id,   assigneeId = ticket_space_member.id
 *
 * That mirrors how each parent already stores its own assignee. Because the
 * database cannot enforce these, the service resolves and cleans them up.
 */
@Entity('checklist')
@Index(['entityType', 'entityId'])
export class Checklist extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ type: 'boolean', default: false })
  isChecked: boolean;

  @Column({ type: 'text', nullable: true })
  attachmentLink: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  entityType: ChecklistEntityType;

  @Column({ type: 'int', nullable: false })
  entityId: number;

  // ── Assignee (optional) ────────────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  assigneeId: number | null;

  // Denormalized so the list renders without a second lookup
  @Column({ type: 'varchar', length: 150, nullable: true })
  assigneeName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assigneeEmail: string | null;

  @Column({ type: 'text', nullable: true })
  assigneeProfilePicUrl: string | null;
}
