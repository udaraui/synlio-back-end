import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Resource } from '../resource/resource.entity';
import { BaseEntity } from '../../common/base/base.entity';
import { Company } from '../../company-management/company/company.entity';
import { Division } from '../../company-management/division/division.entity';
import { User } from '../../user-management/user/user.entity';

@Entity()
export class ResourcePool extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => Company, (company) => company.resourcepools)
  company: Company;

  @ManyToOne(() => Division, (division) => division.resourcepools)
  division: Division;

  @ManyToMany(() => Resource, (resource) => resource.resource_pool, {
    eager: true,
  })
  @JoinTable({
    name: 'resource_pool_resources_resource',
    joinColumn: { name: 'resourcePoolId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resourceId', referencedColumnName: 'id' },
  })
  resources: Resource[];

  @Column({ default: true })
  isActive: boolean; // add is active

  @ManyToOne(() => User, (usr) => usr.own_resource_pools)
  pool_owner: User;

}
