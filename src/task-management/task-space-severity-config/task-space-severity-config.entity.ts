import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpace } from '../task-space/task-space.entity';

@Entity('task_space_severity_config')
export class TaskSpaceSeverityConfig extends BaseEntity {
  @Column()
  taskSpaceId: number;

  @ManyToOne(() => TaskSpace, (space) => space.severityConfigs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskSpaceId' })
  taskSpace: TaskSpace;


  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: '#6366f1' })
  color: string;

  @Column({ type: 'int', default: 0 })
  responseTimeInMinutes: number;

  @Column({ type: 'int', default: 0 })
  resolutionTimeInMinutes: number;
}
