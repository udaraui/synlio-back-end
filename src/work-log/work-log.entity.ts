import { Column, Entity, Index } from 'typeorm';
import { PostType } from '../common/enum/post-type.enum';
import { AssigneeType } from '../common/enum/assignee-type.enum';
import { BaseEntity } from '../common/base/base.entity';

@Entity('work_log')
@Index('companyId_postId_resourceId', ['companyId', 'postId', 'resourceId'])
export class WorkLog extends BaseEntity {
  @Column({ nullable: false })
  companyId: number;

  @Column({ type: 'int', nullable: true })
  divisionId: number | null;

  @Column({ nullable: false })
  postId: number;

  @Column({ nullable: false })
  postCode: string;

  @Column({ type: 'int', nullable: true })
  postEventId: number | null;

  @Column({
    type: 'enum',
    enum: PostType,
    enumName: 'post_type_enum',
    nullable: false,
  })
  postType: PostType;

  @Column({ nullable: false })
  resourceId: number;

  @Column({ nullable: false })
  resourceName: string;

  @Column({ nullable: false })
  resourceEmail: string;

  @Column({
    type: 'enum',
    enum: AssigneeType,
    enumName: 'assignee_type_enum',
    nullable: false,
  })
  resourceType: AssigneeType;

  @Column({ type: 'date', nullable: true })
  startTimeDate: Date | null;

  @Column({ type: 'date', nullable: true })
  endTimeDate: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  effort: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
