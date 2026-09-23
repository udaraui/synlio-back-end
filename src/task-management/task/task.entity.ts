import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpace } from '../task-space/task-space.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { TaskAttachment } from '../task-attachment/task-attachment.entity';
import { TaskEvent } from '../task-event/task-event.entity';
import { TaskSpaceHierarchyLevelConfig } from '../task-space-hierarchy-level/task-space-hierarchy-level-config.entity';
import { TmTaskLabel } from '../task-label/task-label.entity';
import { TaskSpaceStatusConfig } from '../task-space-status-config/task-space-status-config.entity';
import { TaskSpaceSeverityConfig } from '../task-space-severity-config/task-space-severity-config.entity';

export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return data ? parseFloat(data) : 0;
  }
}

@Entity('tm_task')
@Index(['companyId', 'taskSpaceId', 'parentTaskId', 'hierarchyLevelSequence'])
@Index(['companyId', 'taskSpaceId', 'parentTaskId'])
@Index(['companyId', 'statusBase'])
export class Task extends BaseEntity {
  // ── Core ───────────────────────────────────────────────────────────────

  @Column({ nullable: true, length: 100 })
  code: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: false })
  special: boolean;

  @Column({ type: 'int', nullable: false, default: 0 })
  taskVersion: number;

  // ── Progress & Effort ─────────────────────────────────────────────────

@Column({
    type: 'numeric',
    default: 0,
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  progressPercentage: number;

  @Column({
    type: 'decimal',
    default: 0,
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  estimateEffort: number;

  @Column({
    type: 'decimal',
    default: 0,
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  actualEffort: number;

  // ── Dates ─────────────────────────────────────────────────────────────

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'date', nullable: true })
  completionDate: Date;

  @Column({ type: 'date', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'date', nullable: true })
  actualEndDate: Date;

  // ── Ownership ─────────────────────────────────────────────────────────

  @Column({ nullable: true })
  companyId: number;

  @Column({ nullable: true })
  divisionId: number;

  // ── Task Space ────────────────────────────────────────────────────────

  @Column({ nullable: false })
  taskSpaceId: number;

  @ManyToOne(() => TaskSpace, (taskSpace) => taskSpace.tasks, {
    nullable: false,
  })
  @JoinColumn({ name: 'taskSpaceId' })
  taskSpace: TaskSpace;

  // ── Task Space Denormalized ────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  taskSpaceName: string | null;

  @Column({ type: 'varchar', nullable: true })
  taskSpacePrefix: string | null;

  // ── Status ────────────────────────────────────────────────────────────

  @Column({ nullable: true })
  statusId: number;

  @ManyToOne(() => TaskSpaceStatusConfig)
  @JoinColumn({ name: 'statusId' })
  status: TaskSpaceStatusConfig;

  // ── Status Denormalized ────────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  statusName: string | null;

  @Column({ type: 'varchar', nullable: true })
  statusColor: string | null;

  @Column({ type: 'varchar', nullable: true })
  statusBase: string | null;

  // ── Severity ──────────────────────────────────────────────────────────

  @Column({ nullable: true })
  severityId: number;

  @ManyToOne(() => TaskSpaceSeverityConfig)
  @JoinColumn({ name: 'severityId' })
  severity: TaskSpaceSeverityConfig;

  // ── Severity Denormalized ─────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  severityName: string | null;

  @Column({ type: 'varchar', nullable: true })
  severityColor: string | null;

  // ── Parent / Child (self-referencing) ─────────────────────────────────

  @Column({ nullable: true })
  parentTaskId: number;

  @ManyToOne(() => Task, (task) => task.childTasks, { nullable: true })
  @JoinColumn({ name: 'parentTaskId' })
  parentTask: Task;

  @OneToMany(() => Task, (task) => task.parentTask)
  childTasks: Task[];

  // ── Assignee ──────────────────────────────────────────────────────────

  @Column({ nullable: true })
  assigneeId: number;

  @ManyToOne(() => Resource, { nullable: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee: Resource;

  // ── Assignee Denormalized ─────────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  assigneeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  assigneeProfilePicUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  assigneeEmail: string | null;

  // Optional skill (of the assignee) relevant to this task
  @Column({ type: 'varchar', nullable: true })
  assigneeSkill: string | null;

  // ── Co-Assignees ──────────────────────────────────────────────────────

  @ManyToMany(() => Resource)
  @JoinTable({
    name: 'tm_task_co_assignees',
    joinColumn: { name: 'taskId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resourceId', referencedColumnName: 'id' },
  })
  coAssignees: Resource[];

  // ── Members (only applicable on hierarchy level 1 tasks) ──────────────

  @ManyToMany(() => Resource)
  @JoinTable({
    name: 'tm_task_members',
    joinColumn: { name: 'taskId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resourceId', referencedColumnName: 'id' },
  })
  members: Resource[];

  // ── Child Entities ────────────────────────────────────────────────────

  @OneToMany(() => TaskAttachment, (attachment) => attachment.task)
  taskAttachments: TaskAttachment[];

  @ManyToMany(() => TmTaskLabel)
  @JoinTable({
    name: 'tm_task_labels_mapping',
    joinColumn: {
      name: 'taskId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'labelId',
      referencedColumnName: 'id',
    },
  })
  labels: TmTaskLabel[];

  @OneToMany(() => TaskEvent, (taskEvent) => taskEvent.task)
  taskEvents: TaskEvent[];

  // ── Hierarchy Level ───────────────────────────────────────────────────

  @Column({ nullable: true })
  hierarchyLevelConfigId: number;

  @ManyToOne(() => TaskSpaceHierarchyLevelConfig, { nullable: true })
  @JoinColumn({ name: 'hierarchyLevelConfigId' })
  hierarchyLevelConfig: TaskSpaceHierarchyLevelConfig;

  // Denormalized snapshot of the hierarchy level – kept in sync by the service
  @Column({ type: 'varchar', length: 255, nullable: true })
  hierarchyLevelName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  hierarchyLevelIcon: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  hierarchyLevelColor: string;

  @Column({ type: 'int', nullable: true })
  hierarchyLevelSequence: number;
}
