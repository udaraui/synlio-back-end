import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  JoinTable,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Privilege } from '../privilege/privilege.entity';
import { UserCompanyRole } from '../user/user-company-role.entity';
import { BaseEntity } from '../../common/base/base.entity';
import { Company } from '../../company-management/company/company.entity';

@Entity()
@Unique(['role', 'companyId'])
export class Role extends BaseEntity {
  @Column()
  role: string;

  @Column({ nullable: true })
  companyId: number;

  @Column({ default: true })
  isActive: boolean;


  @ManyToMany(() => Privilege, (privilege) => privilege.roles)
  @JoinTable()
  privileges: Privilege[];

  @OneToMany(() => UserCompanyRole, (ucr) => ucr.role)
  userCompanyRoles: UserCompanyRole[];

  @ManyToOne(() => Company, (company) => company.roles)
  @JoinColumn({ name: 'companyId' })
  company: Company;
}
