import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpace } from '../task-space/task-space.entity';

@Entity('task_space_hierarchy_level_config')
export class TaskSpaceHierarchyLevelConfig extends BaseEntity {
  // Task Space reference
  @Column()
  taskSpaceId: number;

  @ManyToOne(() => TaskSpace, (space) => space.hierarchyLevelConfigs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskSpaceId' })
  taskSpace: TaskSpace;

  // Position within this task space
  @Column({ type: 'int', default: 0 })
  sequence: number;

  // Standalone level data (no master reference)
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, default: 'Folder' })
  icon: string;

  @Column({ type: 'varchar', length: 50, default: '#6366f1' })
  color: string;
}
