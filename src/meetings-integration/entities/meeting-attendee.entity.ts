import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Meeting } from './meeting.entity';

@Entity('meeting_attendee')
export class MeetingAttendee extends BaseEntity {
  @Column({ nullable: false })
  meetingId: number;

  /** Optional link to a Synlio user. Set for internal meeting attendees. */
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  /**
   * e.g. 'accepted', 'declined', 'tentative', 'needsAction'
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  responseStatus: string | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  joined: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  providerMetadata: object | null;

  @ManyToOne(() => Meeting, (meeting) => meeting.attendees, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;
}
