import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';

/**
 * Master / template data.
 * Users pick from these records when configuring a task space and may
 * override name / icon / color per-space via TaskSpaceHierarchyLevelConfig.
 * This table must NEVER be written to by space-configuration code.
 */
@Entity()
export class TaskSpaceHierarchyLevel extends BaseEntity {
  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'Folder' })
  icon: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: '#6366f1' })
  color: string;
}
