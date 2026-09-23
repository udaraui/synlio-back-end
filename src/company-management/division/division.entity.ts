import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Company } from '../company/company.entity';
import { User } from '../../user-management/user/user.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { BaseEntity } from '../../common/base/base.entity';

@Entity()
export class Division extends BaseEntity {
  @Column()
  division: string;

  @Column()
  division_code: string;

  @Column()
  companyId: number;

  @Column()
  isActive: boolean;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToMany(() => User, (user) => user.divisions)
  users: User[];

  @OneToMany(() => Resource, (resource) => resource.division)
  resources: Resource[];

  @OneToMany(() => ResourcePool, (resourcepool) => resourcepool.division)
  resourcepools: ResourcePool[];

}
