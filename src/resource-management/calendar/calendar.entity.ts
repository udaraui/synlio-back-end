import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { CalendarDays } from './calendar-days.entity';
import { Resource } from '../resource/resource.entity';
import { Company } from '../../company-management/company/company.entity';
import { BaseEntity } from '../../common/base/base.entity';

@Entity()
export class Calendar extends BaseEntity {
  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.calendars)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @OneToMany(() => CalendarDays, (calendarDays) => calendarDays.calendar, {
    onDelete: 'CASCADE',
  })
  calendarDays: CalendarDays[];

  @OneToMany(() => Resource, (resource) => resource.calendar)
  resources: Resource[];
}
