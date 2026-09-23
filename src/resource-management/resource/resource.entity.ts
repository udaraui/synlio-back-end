import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Calendar } from '../calendar/calendar.entity';
import { ResourceSkill } from './resource-skill.entity';
import { ResourcePool } from '../resource-pool/resource-pool.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { BaseEntity } from '../../common/base/base.entity';
import { Division } from '../../company-management/division/division.entity';
import { Company } from '../../company-management/company/company.entity';
import { Task } from '../../task-management/task/task.entity';
import { ResourceCost } from './resource-cost.entity';
import { PulseWeek } from '../../pulse/pulse-week.entity';

export enum ResourceType {
  INTERNAL = 'Internal',
  EXTERNAL = 'External',
}

@Entity()
@Index(['companyId'])
export class Resource extends BaseEntity {
  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  mobile: number;

  @Column({ nullable: true })
  profile_pic: string;

  @Column()
  working_hours: number;

  @Column({ nullable: true })
  companyId: number;

  @Column({ nullable: true })
  divisionId: number;

  @Column({ nullable: true })
  userId: number;

  @Column({ default: true })
  active_status: boolean;

  @Column({
    type: 'enum',
    enum: ResourceType,
    default: ResourceType.INTERNAL,
  })
  type: ResourceType;

  @Column({ nullable: true })
  reportingPersonId: number | null;

  @ManyToOne(() => Resource, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportingPersonId' })
  reportingPerson: Resource;

  @ManyToOne(() => Company, (company) => company.resources, {
    nullable: true,
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => Division, (division) => division.resources, {
    nullable: true,
  })
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  @ManyToMany(() => ResourcePool, (resourcepool) => resourcepool.resources, {
    nullable: true,
  })
  resource_pool: ResourcePool;

  @OneToMany(() => ResourceSkill, (rs) => rs.resource, { cascade: true })
  resourceSkills: ResourceSkill[];

  @ManyToOne(() => Calendar, (calendar) => calendar.resources, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  calendar: Calendar;


  @ManyToMany(() => TaskSpace, (taskSpace) => taskSpace.resources, {
    nullable: true,
  })
  taskSpaces: TaskSpace[];

  @OneToMany(() => Task, (task) => task.assignee)
  tasks: Task[];

  @OneToMany(() => Task, (task) => task.coAssignees)
  tasksAsCoAssignee: Task[];

  @OneToOne(() => ResourceCost, (rc) => rc.resource, {
    nullable: true,
    cascade: true,
  })
  resourceCost: ResourceCost;

  @OneToMany(() => PulseWeek, (pulseWeek) => pulseWeek.submittedTo)
  submittedPulseWeeks: PulseWeek[];

  @OneToMany(() => PulseWeek, (pulseWeek) => pulseWeek.approvedBy)
  approvedPulseWeeks: PulseWeek[];
}
