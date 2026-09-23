import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { ResourceCost } from '../resource/resource-cost.entity';

@Entity()
export class Currency extends BaseEntity {
  @Column({ unique: true })
  code: string; // e.g. USD, EUR, LKR

  @Column()
  name: string; // e.g. US Dollar, Euro, Sri Lankan Rupee

  @Column({ nullable: true })
  symbol: string; // e.g. $, €, Rs

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ResourceCost, (rc) => rc.currency)
  resourceCosts: ResourceCost[];
}
