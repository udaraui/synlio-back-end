import { Column, Entity, Index, ManyToOne, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { User } from '../../user-management/user/user.entity';
import { MeetingProvider } from './meeting-integration-connection.entity';
import { MeetingAttendee } from './meeting-attendee.entity';
import { MeetingActionState } from './meeting-action-state.entity';

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  ONGOING = 'ongoing',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

@Entity('meeting')
@Index('IDX_meeting_provider_externalId_owner', ['provider', 'externalId', 'ownerUserId'], {
  unique: true,
})
@Index('IDX_meeting_ownerUserId_startTime', ['ownerUserId', 'startTime'])
export class Meeting extends BaseEntity {
  @Column({
    type: 'enum',
    enum: MeetingProvider,
    enumName: 'meeting_provider_enum',
    nullable: false,
  })
  provider: MeetingProvider;

  @Column({ type: 'varchar', length: 500, nullable: false })
  externalId: string;

  @Column({ nullable: false })
  ownerUserId: number;

  @Column({ type: 'varchar', length: 500, nullable: false })
  title: string;

  /** Legacy column — kept for backward compatibility. Same value as scheduledStartTime. */
  @Column({ type: 'timestamp', nullable: false })
  startTime: Date;

  /** Legacy column — kept for backward compatibility. Same value as scheduledEndTime. */
  @Column({ type: 'timestamp', nullable: true })
  endTime: Date | null;

  /** The original provider-sourced start time. Never modified after sync. */
  @Column({ type: 'timestamp', nullable: false })
  scheduledStartTime: Date;

  /** The original provider-sourced end time. Never modified after sync. */
  @Column({ type: 'timestamp', nullable: true })
  scheduledEndTime: Date | null;

  /** User-edited actual start time. Used for display and calculations when set. */
  @Column({ type: 'timestamp', nullable: true })
  actualStartTime: Date | null;

  /** User-edited actual end time. Used for display and calculations when set. */
  @Column({ type: 'timestamp', nullable: true })
  actualEndTime: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMinutes: number | null;

  /**
   * User-edited actual duration in minutes.
   * Used for all calculations & display when set.
   * Falls back to durationMinutes (from provider) when null.
   */
  @Column({ type: 'int', nullable: true })
  actualDurationMinutes: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  joinUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  organizerEmail: string | null;

  @Column({
    type: 'enum',
    enum: MeetingStatus,
    enumName: 'meeting_status_enum',
    default: MeetingStatus.SCHEDULED,
    nullable: false,
  })
  status: MeetingStatus;

  @Column({ type: 'jsonb', nullable: true })
  providerMetadata: object | null;

  @Column({ type: 'timestamp', nullable: true })
  syncedAt: Date | null;

  /** The user who originally created this internal meeting (organizerId). Null for provider-synced meetings. */
  @Column({ type: 'int', nullable: true })
  organizerId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  owner: User;

  @OneToMany(() => MeetingAttendee, (attendee) => attendee.meeting, {
    cascade: true,
  })
  attendees: MeetingAttendee[];

  @OneToMany(() => MeetingActionState, (as) => as.meeting)
  actionStates: MeetingActionState[];
}
