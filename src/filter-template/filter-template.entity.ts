import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../common/base/base.entity';
import { User } from '../user-management/user/user.entity';
import { Company } from '../company-management/company/company.entity';

export enum FilterTemplateType {
  TASK = 'TASK',
  TICKET = 'TICKET',
}

export enum FilterTemplateVisibility {
  PRIVATE = 'PRIVATE', // Only creator
  SHARED = 'SHARED',   // Shared with specific users in the company
  PUBLIC = 'PUBLIC',   // Shared with all users in the company
}

@Entity('filter_template')
@Index(['companyId', 'type', 'visibility'])
@Index(['userId'])
export class FilterTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  type: FilterTemplateType;

  @Column({
    type: 'varchar',
    length: 20,
    default: FilterTemplateVisibility.PRIVATE,
    nullable: false,
  })
  visibility: FilterTemplateVisibility;

  @Column({ type: 'jsonb', nullable: false })
  filters: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  // Creator / Owner of the template
  @Column({ nullable: false })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Company the template belongs to
  @Column({ nullable: false })
  companyId: number;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // Shared users when visibility is 'SHARED'
  @ManyToMany(() => User)
  @JoinTable({
    name: 'filter_template_shared_users',
    joinColumn: { name: 'templateId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  sharedWith: User[];
}
