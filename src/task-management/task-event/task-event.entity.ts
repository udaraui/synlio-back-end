import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Task } from '../task/task.entity';

@Entity('tm_task_event')
export class TaskEvent extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  eventType: string;

  @Column({ type: 'int', nullable: false, default: 0 })
  version: number;

  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  @Column({ type: 'jsonb', default: {}, nullable: false })
  payload: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;

  @Column({ nullable: false })
  taskId: number;

  @ManyToOne(() => Task, (task) => task.taskEvents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task;
}
