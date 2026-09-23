import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  Unique,
} from 'typeorm';
import { UserCompanyRole } from './user-company-role.entity';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { BaseEntity } from '../../common/base/base.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { PulseWeek } from '../../pulse/pulse-week.entity';

@Entity('user')
@Unique('unique_user-email', ['email'])
export class User extends BaseEntity {
  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ nullable: true })
  mobile_number: string;

  @Column()
  email: string;

  @Column({ nullable: false })
  password: string;

  @Column({ nullable: true })
  profile_picture: string;

  @Column({ nullable: true, default: null })
  hashedRefreshToken?: string;

  @Column({ nullable: true, default: null })
  passwordResetToken?: string;

  @Column({ type: 'timestamp', nullable: true, default: null })
  passwordResetTokenExpiry?: Date;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Company, (company) => company.users)
  @JoinTable()
  companies: Company[];

  @ManyToMany(() => Division, (division) => division.users)
  @JoinTable()
  divisions: Division[];

  @OneToMany(() => UserCompanyRole, (ucr) => ucr.user, { cascade: true })
  userCompanyRoles: UserCompanyRole[];

  @OneToMany(() => ResourcePool, (rp) => rp.pool_owner)
  own_resource_pools: ResourcePool[];


  @ManyToMany(() => TaskSpace, (taskSpace) => taskSpace.owners, {
    nullable: true,
  })
  taskSpaces: TaskSpace[];

  @OneToMany(() => PulseWeek, (pulseWeek) => pulseWeek.user)
  pulseWeeks: PulseWeek[];

  @Column({ nullable: true })
  defaultCompanyId: number;
}
