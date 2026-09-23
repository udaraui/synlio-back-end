import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';

/**
 * A per-space alert rule that controls which events trigger an alert,
 * what channel is used (in-app / email / both), and who receives it (TO / CC).
 *
 * Merging strategy: when multiple rules match the same event, ALL are unioned
 * before dispatch — channels union, recipient flags union, TO wins over CC.
 *
 * If NO active rules match a given event the alert services fall back to the
 * original hardcoded recipient matrix (backward-compatible default).
 */
@Entity('space_alert_rule')
export class SpaceAlertRule extends BaseEntity {
  /** Human-readable label shown in the configure UI */
  @Column({ length: 100 })
  name: string;

  /** 'task' | 'ticket' */
  @Column({ type: 'varchar', length: 10 })
  spaceType: string;

  /** FK to task_space.id or ticket_space.id depending on spaceType */
  @Column()
  spaceId: number;

  /**
   * JSON array of event enum values this rule listens to.
   * e.g. ["TASK_CREATED", "STATUS_CHANGED"]
   * Using jsonb so TypeORM always returns a parsed JS array (never a raw string).
   */
  @Column({ type: 'jsonb', default: '[]' })
  events: string[];

  /** 'in_app' | 'email' | 'both' */
  @Column({ type: 'varchar', length: 10 })
  channel: string;

  // ── TO Recipients ─────────────────────────────────────────────────────────
  @Column({ default: false })
  toAssignee: boolean;

  /** Task only: co-assignees + member watchers */
  @Column({ default: false })
  toCoAssignees: boolean;

  /** Ticket only: participants */
  @Column({ default: false })
  toParticipants: boolean;

  /** User who originally created the task/ticket */
  @Column({ default: false })
  toCreator: boolean;

  /** User who triggered this specific event */
  @Column({ default: false })
  toActor: boolean;

  /** Explicitly @mentioned User IDs → TO */
  @Column({ type: 'jsonb', default: '[]' })
  toAdditionalUserIds: number[];

  // ── CC Recipients ─────────────────────────────────────────────────────────
  @Column({ default: false })
  ccAssignee: boolean;

  /** Task only */
  @Column({ default: false })
  ccCoAssignees: boolean;

  /** Ticket only */
  @Column({ default: false })
  ccParticipants: boolean;

  @Column({ default: false })
  ccCreator: boolean;

  @Column({ default: false })
  ccActor: boolean;

  /** Explicitly @mentioned User IDs → CC */
  @Column({ type: 'jsonb', default: '[]' })
  ccAdditionalUserIds: number[];

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  @Column({ default: true })
  isActive: boolean;
}
