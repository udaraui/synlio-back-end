import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpaceHierarchyLevelConfig } from '../task-space-hierarchy-level/task-space-hierarchy-level-config.entity';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { User } from '../../user-management/user/user.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { Task } from '../task/task.entity';
import { TaskSpaceStatusConfig } from '../task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../task-space-severity-config/task-space-severity-config.entity';

@Entity()
export class TaskSpace extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  prefix: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  // Company Relation
  @Column({ nullable: false })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // Division Relation
  @Column({ nullable: true })
  divisionId: number;

  @ManyToOne(() => Division, { nullable: true })
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  // Hierarchy Level Config (per-space customizations of master hierarchy levels)
  @OneToMany(() => TaskSpaceHierarchyLevelConfig, (config) => config.taskSpace)
  hierarchyLevelConfigs: TaskSpaceHierarchyLevelConfig[];

  // Owners Relation (many-to-many with User)
  @ManyToMany(() => User, (user) => user.taskSpaces, { nullable: true })
  @JoinTable({
    name: 'task_space_owners',
    joinColumn: { name: 'taskSpaceId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  owners: User[];

  // Resources Relation (many-to-many with Resource)
  @ManyToMany(() => Resource, (resource) => resource.taskSpaces, {
    nullable: true,
  })
  @JoinTable({
    name: 'task_space_resources',
    joinColumn: { name: 'taskSpaceId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resourceId', referencedColumnName: 'id' },
  })
  resources: Resource[];

  // Tasks Relation (one-to-many)
  @OneToMany(() => Task, (task) => task.taskSpace)
  tasks: Task[];

  @OneToMany(() => TaskSpaceStatusConfig, (config) => config.taskSpace)
  statusConfigs: TaskSpaceStatusConfig[];

  @OneToMany(() => TaskSpaceSeverityConfig, (config) => config.taskSpace)
  severityConfigs: TaskSpaceSeverityConfig[];
}
