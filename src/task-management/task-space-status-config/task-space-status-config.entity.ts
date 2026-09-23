 import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpace } from '../task-space/task-space.entity';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';

@Entity('task_space_status_config')
export class TaskSpaceStatusConfig extends BaseEntity {
  @Column()
  taskSpaceId: number;

  @ManyToOne(() => TaskSpace, (space) => space.statusConfigs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskSpaceId' })
  taskSpace: TaskSpace;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: '#6366f1' })
  color: string;

  @Column({ type: 'enum', enum: StatusBaseEnum })
  base: StatusBaseEnum;

  @Column({ type: 'boolean', default: false })
  isPrimaryBase: boolean;
}
