import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Task } from '../task/task.entity';

@Entity('tm_task_attachment')
export class TaskAttachment extends BaseEntity {
  @Column({ type: 'text', nullable: false })
  link: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: false })
  taskId: number;

  @ManyToOne(() => Task, (task) => task.taskAttachments, { nullable: false })
  @JoinColumn({ name: 'taskId' })
  task: Task;
}
