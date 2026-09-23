import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { User } from '../../user-management/user/user.entity';

@Entity('new_activity')
@Index('IDX_new_activity_ownerUserId_companyId', ['ownerUserId', 'companyId'])
@Index('IDX_new_activity_ownerUserId_startDate', ['ownerUserId', 'startDate'])
export class NewActivity extends BaseEntity {
  /** The user this activity belongs to */
  @Column({ nullable: false })
  ownerUserId: number;

  /** Company this activity belongs to */
  @Column({ nullable: false })
  companyId: number;

  /** Activity title (required) */
  @Column({ type: 'varchar', length: 500, nullable: false })
  title: string;

  /** Optional description */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Start date/time of the activity */
  @Column({ type: 'timestamp', nullable: false })
  startDate: Date;

  /** End date/time of the activity */
  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  /**
   * Duration in minutes (effort).
   * If endDate is provided, this is auto-calculated; otherwise entered manually.
   */
  @Column({ type: 'int', nullable: true })
  durationMinutes: number | null;

  /** Optional task link. When set, this activity is associated with a task */
  @Column({ type: 'int', nullable: true })
  taskId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  owner: User;
}
