import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Resource } from './resource.entity';
import { Currency } from '../currency/currency.entity';

export enum CostRateType {
  PER_DAY = 'per_day',
  PER_HOUR = 'per_hour',
}

@Entity()
export class ResourceCost extends BaseEntity {
  @Column()
  resourceId: number;

  @OneToOne(() => Resource, (resource) => resource.resourceCost, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  cost: number;

  @Column({ nullable: true })
  currencyId: number;

  @ManyToOne(() => Currency, (currency) => currency.resourceCosts, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'currencyId' })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: CostRateType,
    default: CostRateType.PER_DAY,
  })
  rate_type: CostRateType;
}
