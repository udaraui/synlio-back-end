import { BaseEntity } from '../../common/base/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PulseType } from '../../common/enum/pulse-type.enum';
import { PostType } from '../../common/enum/post-type.enum';
import { AssigneeType } from '../../common/enum/assignee-type.enum';
import { PulseWeek } from './pulse-week.entity';

@Entity('pulse')
export class Pulse extends BaseEntity {
  @Column({ nullable: false })
  companyId: number;

  @Column({
    type: 'enum',
    enum: PulseType,
    enumName: 'pulse_type_enum',
    nullable: false,
  })
  pulseType: PulseType;

  @Column({
    type: 'enum',
    enum: PostType,
    enumName: 'post_type_enum',
    nullable: true,
  })
  postType: PostType;

  @Column({ nullable: true })
  postId: number;

  @Column({ nullable: true, length: 100 })
  postCode: string;

  @Column({ nullable: true })
  postName: string;

  @Column({ nullable: true })
  postSpaceId: number;

  @Column({ nullable: true })
  postSpaceName: string;

  @Column({
    type: 'enum',
    enum: AssigneeType,
    enumName: 'assignee_type_enum',
    nullable: false,
  })
  resourceType: AssigneeType;

  @Column({ nullable: true })
  pulseSummary: string;

  @Column({ nullable: true })
  attentionConditions: string;

  @Column({ nullable: true })
  meetingType: string;

  @Column({ type: 'decimal', nullable: true })
  allocatedHours: number;

  @ManyToOne(() => PulseWeek)
  @JoinColumn({ name: 'pulseWeekId' })
  pulseWeek: PulseWeek;

  @Column({ nullable: false })
  pulseWeekId: number;
}
