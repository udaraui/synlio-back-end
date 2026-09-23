import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { Calendar } from './calendar.entity';
import { BaseEntity } from '../../common/base/base.entity';

export enum DayType {
  HALF = 'HALF',
  FULL = 'FULL',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}
@Entity()
export class CalendarDays extends BaseEntity {
  @Column()
  date: Date;

  @Column()
  year: number;

  // First date of the first week of the year this day belongs to.
  @Column({ type: 'date', nullable: true })
  yearStartDate: Date;

  // 1-based week index inside the year, counted from yearStartDate.
  @Column({ type: 'int', nullable: true })
  weekNumber: number;

  // Weekday name of `date` (MONDAY ... SUNDAY).
  @Column({ type: 'varchar', length: 20, nullable: true })
  daysOfWeek: DayOfWeek;

  // First date of the week this day belongs to.
  @Column({ type: 'date', nullable: true })
  weekStartDate: Date;

  // Last date (weekStartDate + 6) of the week this day belongs to.
  @Column({ type: 'date', nullable: true })
  weekEndDate: Date;

  @Column({ default: false })
  isHoliday: boolean;

  @Column()
  isWeekend: boolean;

  @Column({ default: true })
  isWorkingDay: boolean;

  // Only For Frontend View
  @Column({ default: false })
  isSpecialWorkingDay: boolean;

  @Column()
  dayType: DayType;

  @Column()
  calendarId: number;

  @ManyToOne(() => Calendar, (calendar) => calendar.id)
  @JoinColumn({ name: 'calendarId' })
  calendar: Calendar;
}
