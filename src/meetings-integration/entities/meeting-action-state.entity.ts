import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Meeting } from './meeting.entity';
import { User } from '../../user-management/user/user.entity';

export enum MeetingActionStateEnum {
  NONE = 'none',
  IGNORED = 'ignored',
  LINKED_TO_TASK = 'linked_to_task',
}

@Entity('meeting_action_state')
@Index('IDX_mas_meetingId_userId', ['meetingId', 'actedByUserId'], { unique: true })
export class MeetingActionState extends BaseEntity {
  @Column({ type: 'int', nullable: false })
  meetingId: number;

  @Column({ type: 'int', nullable: false })
  actedByUserId: number;

  @Column({
    type: 'enum',
    enum: MeetingActionStateEnum,
    enumName: 'meeting_action_state_enum',
    default: MeetingActionStateEnum.NONE,
    nullable: false,
  })
  state: MeetingActionStateEnum;

  @Column({ type: 'int', nullable: true })
  taskId: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  actedAt: Date;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actedByUserId' })
  actedBy: User;
}
