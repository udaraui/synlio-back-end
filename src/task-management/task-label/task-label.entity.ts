import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpace } from '../task-space/task-space.entity';
@Entity('tm_task_label')
export class TmTaskLabel extends BaseEntity {
  @Column({ nullable: false })
  name: string;
  @Column({ nullable: false })
  taskSpaceId: number;
  @ManyToOne(() => TaskSpace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskSpaceId' })
  taskSpace: TaskSpace;
}
