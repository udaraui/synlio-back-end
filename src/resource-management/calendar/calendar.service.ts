import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, MoreThanOrEqual, Raw } from 'typeorm';
import { Calendar } from './calendar.entity';
import { CalendarDays, DayOfWeek, DayType } from './calendar-days.entity';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';
import { Company } from '../../company-management/company/company.entity';
import { Role } from '../../user-management/role/role.entity';
import { Resource } from '../resource/resource.entity';

@Injectable()
export class CalendarService {
  constructor(private readonly entityManager: EntityManager) { }

  /**
   * Past days are frozen: every holiday / working day change applies from
   * today onwards only.
   */
  private assertNotPast(date: Date | string): void {
    const selectedDate = this.startOfDay(date);
    const today = this.startOfDay(new Date());

    if (selectedDate < today) {
      throw new BadRequestException(
        'Past dates cannot be changed. Updates apply from today onwards',
      );
    }
  }

  private normalizeDayType(value: any): DayType {
    return value?.toString().toUpperCase() === 'HALF'
      ? DayType.HALF
      : DayType.FULL;
  }

  /**
   * The single place where a day's flags are decided, so every scenario in the
   * day-state matrix stays consistent:
   *
   *   normal working day        F / F / T / F / FULL
   *   repeated holiday full     F / T / F / F / FULL
   *   repeated holiday half     F / T / T / F / HALF
   *   special holiday full      T / F / F / F / FULL   (T / T / F / F on a weekend)
   *   special holiday half      T / F / T / F / HALF
   *   special working day       F / T / F / T / FULL|HALF
   *                       (isHoliday / isWeekend / isWorkingDay / isSpecialWorkingDay / dayType)
   *
   * A day only counts as workable when it is a plain day, or when the half of
   * it that is not a holiday / weekend is still worked. A special working day
   * is never flagged as a working day: it stays an exception on a weekend.
   */
  private composeDayFlags(input: {
    isHoliday: boolean;
    isWeekend: boolean;
    isSpecialWorkingDay: boolean;
    dayType: DayType;
  }) {
    const { isHoliday, isWeekend, isSpecialWorkingDay, dayType } = input;

    const isWorkingDay = isSpecialWorkingDay
      ? false
      : !isHoliday && !isWeekend
        ? true
        : dayType === DayType.HALF;

    return { isHoliday, isWeekend, isSpecialWorkingDay, dayType, isWorkingDay };
  }

  /**
   * The calendar's current repeated-holiday pattern as weekday -> type,
   * with Monday = 0 ... Sunday = 6.
   *
   * Days carrying a special holiday or special working day keep the weekend
   * flag but report the override's `dayType`, so the pattern is read from clean
   * days first and only falls back to an overridden one when a weekday has none.
   */
  private async readWeekendPattern(
    calendarId: number,
    fromDate?: Date,
  ): Promise<Map<number, DayType>> {
    const query = this.entityManager
      .createQueryBuilder(CalendarDays, 'day')
      .where('day."calendarId" = :calendarId', { calendarId })
      .andWhere('day."isWeekend" = true');

    if (fromDate) {
      query.andWhere('day.date >= :fromDate', { fromDate });
    }

    const weekendDays = await query.getMany();

    const pattern = new Map<number, DayType>();
    const fallback = new Map<number, DayType>();

    for (const day of weekendDays) {
      const weekDay = (new Date(day.date).getDay() + 6) % 7;

      if (day.isHoliday || day.isSpecialWorkingDay) {
        if (!fallback.has(weekDay)) fallback.set(weekDay, day.dayType);
        continue;
      }

      if (!pattern.has(weekDay)) pattern.set(weekDay, day.dayType);
    }

    fallback.forEach((type, weekDay) => {
      if (!pattern.has(weekDay)) pattern.set(weekDay, type);
    });

    return pattern;
  }

  /**
   * The repeated-holiday type underneath a day.
   *
   * A clean weekend day carries it directly; once an override sits on top, its
   * `dayType` belongs to the override, so the pattern has to be read from a
   * clean day of the same weekday.
   */
  private async getWeekendBaseType(
    calendarId: number,
    day: CalendarDays,
  ): Promise<DayType> {
    const isClean = !day.isHoliday && !day.isSpecialWorkingDay;
    return isClean
      ? day.dayType
      : this.resolveWeekendBaseType(calendarId, new Date(day.date));
  }

  /**
   * The repeated-holiday type a weekday falls back to when a special holiday
   * or special working day is removed from it.
   */
  private async resolveWeekendBaseType(
    calendarId: number,
    date: Date,
  ): Promise<DayType> {
    const sibling = await this.entityManager
      .createQueryBuilder(CalendarDays, 'day')
      .where('day."calendarId" = :calendarId', { calendarId })
      .andWhere('day."isWeekend" = true')
      .andWhere('day."isHoliday" = false')
      .andWhere('day."isSpecialWorkingDay" = false')
      .andWhere('EXTRACT(ISODOW FROM day.date) = :isoDow', {
        isoDow: ((date.getDay() + 6) % 7) + 1,
      })
      .getOne();

    return sibling?.dayType ?? DayType.FULL;
  }

  /**
   * A freshly generated day is always a plain full working day. Holidays,
   * weekends and special working days are applied afterwards, never at
   * generation time.
   */
  private static readonly DEFAULT_DAY_FLAGS = {
    isHoliday: false,
    isWeekend: false,
    isWorkingDay: true,
    isSpecialWorkingDay: false,
    dayType: DayType.FULL,
  };

  private static readonly WEEK_DAY_NAMES: DayOfWeek[] = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];

  private startOfDay(date: Date | string): Date {
    const parsed = new Date(date);
    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  /**
   * Builds the plain day rows of one calendar year.
   *
   * The year is week aligned: it starts on `yearStartDate` (the first date of
   * week 1) and is made of whole 7-day weeks. A week belongs to the year when
   * the majority of it (its 4th day) still falls before the same date one year
   * later, so a year is 52 weeks (364 days) and 53 weeks (371 days) whenever
   * the drift makes an extra week fit.
   */
  private buildYearDays(yearStartDate: Date | string): Array<{
    date: Date;
    year: number;
    yearStartDate: Date;
    weekNumber: number;
    daysOfWeek: DayOfWeek;
    weekStartDate: Date;
    weekEndDate: Date;
  }> {
    const yearStart = this.startOfDay(yearStartDate);

    const nextYearStart = new Date(yearStart);
    nextYearStart.setFullYear(yearStart.getFullYear() + 1);

    const days: Array<{
      date: Date;
      year: number;
      yearStartDate: Date;
      weekNumber: number;
      daysOfWeek: DayOfWeek;
      weekStartDate: Date;
      weekEndDate: Date;
    }> = [];

    let weekStart = yearStart;
    let weekNumber = 1;

    while (this.addDays(weekStart, 3) < nextYearStart) {
      const weekEnd = this.addDays(weekStart, 6);

      for (let offset = 0; offset < 7; offset++) {
        const date = this.addDays(weekStart, offset);

        days.push({
          date,
          // `year` stays the real calendar year of the date so the existing
          // year filters and year navigation keep working.
          year: date.getFullYear(),
          yearStartDate: yearStart,
          weekNumber,
          daysOfWeek: CalendarService.WEEK_DAY_NAMES[date.getDay()],
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
        });
      }

      weekStart = this.addDays(weekStart, 7);
      weekNumber++;
    }

    return days;
  }

  /**
   * Reports the calendar's week alignment and whether it can still change.
   *
   * The year start date drives week numbering and the year's date range, so
   * moving it means regenerating every day. That is only safe while nothing
   * has been configured on those days and no resource follows the calendar.
   */
  async getWeekConfig(id: number, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const calendar = await this.entityManager.findOne(Calendar, { where });
    if (!calendar) {
      throw new NotFoundException(`Calendar with ID ${id} not found`);
    }

    const [firstDay, yearStarts, blockers] = await Promise.all([
      this.entityManager.findOne(CalendarDays, {
        where: { calendarId: id },
        order: { date: 'ASC' },
      }),
      this.entityManager
        .createQueryBuilder(CalendarDays, 'day')
        .select('DISTINCT day."yearStartDate"', 'yearStartDate')
        .where('day."calendarId" = :id', { id })
        .getRawMany(),
      this.collectYearStartBlockers(id),
    ]);

    const yearStart = firstDay?.yearStartDate ?? firstDay?.date ?? null;

    // What an extension would add next: the weeks continue straight after the
    // last generated day, so the next year is fully determined already.
    const lastDay = await this.entityManager.findOne(CalendarDays, {
      where: { calendarId: id },
      order: { date: 'DESC' },
    });

    const nextYearStart = lastDay
      ? this.addDays(this.startOfDay(lastDay.date), 1)
      : null;
    const nextYearDays = nextYearStart
      ? this.buildYearDays(nextYearStart)
      : null;
    const nextYearLastDay = nextYearDays?.[nextYearDays.length - 1];

    // Every year the calendar covers, oldest first, plus the one running today.
    const sortedYearStarts = yearStarts
      .filter((row) => row.yearStartDate)
      .map((row) => this.startOfDay(row.yearStartDate))
      .sort((a, b) => a.getTime() - b.getTime());

    const todayStart = this.startOfDay(new Date());
    const currentYearStart =
      [...sortedYearStarts].reverse().find((start) => start <= todayStart) ??
      sortedYearStarts[0] ??
      null;

    return {
      yearStartDate: yearStart ? this.toIsoDate(yearStart) : null,
      yearStarts: sortedYearStarts.map((start) => this.toIsoDate(start)),
      currentYearStartDate: currentYearStart
        ? this.toIsoDate(currentYearStart)
        : null,
      yearCount: sortedYearStarts.length,
      isEditable: blockers.length === 0,
      blockers,
      lastDate: lastDay ? this.toIsoDate(lastDay.date) : null,
      nextYear: nextYearStart ? nextYearStart.getFullYear() : null,
      nextYearStartDate: nextYearStart ? this.toIsoDate(nextYearStart) : null,
      nextYearEndDate: nextYearLastDay
        ? this.toIsoDate(nextYearLastDay.date)
        : null,
      nextYearWeeks: nextYearLastDay ? nextYearLastDay.weekNumber : null,
      // The weekly pattern the new year would inherit.
      repeatedHolidayCount: (await this.readWeekendPattern(id)).size,
    };
  }

  /** Human readable reasons why the year start date is locked. */
  private async collectYearStartBlockers(
    calendarId: number,
  ): Promise<string[]> {
    const [holidays, weekends, specialWorkingDays, resources] =
      await Promise.all([
        this.entityManager.count(CalendarDays, {
          where: { calendarId, isHoliday: true },
        }),
        this.entityManager.count(CalendarDays, {
          where: { calendarId, isWeekend: true },
        }),
        this.entityManager.count(CalendarDays, {
          where: { calendarId, isSpecialWorkingDay: true },
        }),
        this.entityManager.count(Resource, {
          where: { calendar: { id: calendarId } },
        }),
      ]);

    const blockers: string[] = [];
    if (holidays > 0) {
      blockers.push(`${holidays} holiday(s) configured`);
    }
    if (weekends > 0) {
      blockers.push(`${weekends} repeated holiday / weekend day(s) configured`);
    }
    if (specialWorkingDays > 0) {
      blockers.push(`${specialWorkingDays} special working day(s) configured`);
    }
    if (resources > 0) {
      blockers.push(`${resources} resource(s) assigned to this calendar`);
    }
    return blockers;
  }

  private toIsoDate(date: Date | string): string {
    const value = this.startOfDay(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(value.getDate()).padStart(2, '0')}`;
  }

  async createCalendar(
    calendarData: CreateCalendarDto,
    authUser: any,
    companyId: number,
  ): Promise<Calendar> {
    // console.log('Creating calendar with data:', calendarData);
    // console.log('companyId:', companyId);
    // console.log('authUser:', authUser);

    if (!authUser || !authUser.email) {
      throw new Error('Authentication required: User information is missing');
    }

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        try {
          const resolvedCompanyId =
            companyId && companyId !== 0 ? companyId : calendarData.companyId;
          const company = await transactionalEntityManager.findOne(Company, {
            where: { id: resolvedCompanyId },
          });
          if (!company) {
            throw new Error('Company not Found');
          }
          if (!calendarData.yearStartDate) {
            throw new BadRequestException('Year start date is required');
          }

          let newCalendar: any = new Calendar();
          newCalendar = Object.assign(newCalendar, calendarData);
          delete newCalendar.yearStartDate;

          if (newCalendar.id == null || newCalendar.id == 0) {
            delete newCalendar.id;
          }
          newCalendar.company = company;
          newCalendar.createdBy = authUser.email;

          const savedCalendar =
            await transactionalEntityManager.save(newCalendar);

          // 2. Generate the week-aligned days of the first calendar year
          const calendarDays = this.buildYearDays(
            calendarData.yearStartDate,
          ).map((day) =>
            transactionalEntityManager.create(CalendarDays, {
              ...day,
              ...CalendarService.DEFAULT_DAY_FLAGS,
              calendarId: savedCalendar.id,
              createdBy: authUser.email,
            }),
          );

          await transactionalEntityManager.save(calendarDays);

          return savedCalendar;
        } catch (error) {
          console.error('Failed to create calendar:', error);
          if (error instanceof HttpException) {
            throw error;
          }
          throw new InternalServerErrorException(
            'Could not create calendar. Transaction rolled back',
          );
        }
      },
    );
  }

  async extendCalendar(
    id: number,
    year: number,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const calendar = await this.entityManager.findOne(Calendar, {
      where,
    });

    if (!calendar) {
      throw new NotFoundException(`Calendar with ID ${id} not found`);
    }

    // The new year has to continue the existing week sequence, so it starts on
    // the day right after the last generated day.
    const lastDay = await this.entityManager.findOne(CalendarDays, {
      where: { calendar: { id } },
      order: { date: 'DESC' },
    });

    const nextYearStart = lastDay
      ? this.addDays(this.startOfDay(lastDay.date), 1)
      : this.startOfDay(new Date(year, 0, 1));

    if (lastDay && nextYearStart.getFullYear() > year) {
      throw new BadRequestException(
        `Calendar already has days for the year ${year}`,
      );
    }

    if (lastDay && nextYearStart.getFullYear() < year) {
      throw new BadRequestException(
        `Weeks must stay continuous. Extend the calendar to ${nextYearStart.getFullYear()} first`,
      );
    }

    // The new year carries the weekly pattern the calendar already follows;
    // one-off holidays and special working days are not copied forward.
    const pattern = await this.readWeekendPattern(id);

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        try {
          const generated = this.buildYearDays(nextYearStart);

          const calendarDays = generated.map((day) => {
            const weekDay = (day.date.getDay() + 6) % 7;
            const patternType = pattern.get(weekDay);

            return transactionalEntityManager.create(CalendarDays, {
              ...day,
              ...(patternType
                ? this.composeDayFlags({
                  isHoliday: false,
                  isWeekend: true,
                  isSpecialWorkingDay: false,
                  dayType: patternType,
                })
                : CalendarService.DEFAULT_DAY_FLAGS),
              calendarId: calendar.id,
              createdBy: authUser.email,
            });
          });

          await transactionalEntityManager.save(calendarDays, { chunk: 200 });

          const lastGenerated = generated[generated.length - 1];

          return {
            message: `Calendar extended for year ${year}`,
            year,
            startDate: this.toIsoDate(nextYearStart),
            endDate: this.toIsoDate(lastGenerated.date),
            weeks: lastGenerated.weekNumber,
            daysCreated: generated.length,
            repeatedHolidaysApplied: pattern.size,
          };
        } catch (error) {
          console.error('Failed to extend calendar:', error);
          if (error instanceof HttpException) {
            throw error;
          }
          throw new InternalServerErrorException(
            'Could not extend calendar. Transaction rolled back',
          );
        }
      },
    );
  }

  async updateCalendar(
    id: number,
    data: UpdateCalendarDto,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const calendar = await this.entityManager.findOne(Calendar, {
      where,
    });

    if (!calendar) {
      throw new HttpException('Calendar not found', HttpStatus.NOT_FOUND);
    }

    calendar.name = data.name;
    calendar.isActive = data.isActive;
    calendar.updatedBy = authUser.email;

    if (!data.yearStartDate) {
      return this.entityManager.save(calendar);
    }

    const newYearStart = this.startOfDay(data.yearStartDate);

    const firstDay = await this.entityManager.findOne(CalendarDays, {
      where: { calendarId: id },
      order: { date: 'ASC' },
    });
    const currentYearStart = firstDay?.yearStartDate ?? firstDay?.date ?? null;

    // Nothing to regenerate when the week alignment is unchanged.
    if (
      currentYearStart &&
      this.toIsoDate(currentYearStart) === this.toIsoDate(newYearStart)
    ) {
      return this.entityManager.save(calendar);
    }

    const blockers = await this.collectYearStartBlockers(id);
    if (blockers.length > 0) {
      throw new BadRequestException(
        `The year start date cannot be changed once the calendar is in use: ${blockers.join(
          ', ',
        )}. Create a new calendar instead`,
      );
    }

    // Keep the same number of years the calendar already covered, chaining each
    // one after the previous so the weeks stay continuous.
    const yearStarts = await this.entityManager
      .createQueryBuilder(CalendarDays, 'day')
      .select('DISTINCT day."yearStartDate"', 'yearStartDate')
      .where('day."calendarId" = :id', { id })
      .getRawMany();
    const yearCount = Math.max(
      yearStarts.filter((row) => row.yearStartDate).length,
      1,
    );

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        try {
          await transactionalEntityManager.delete(CalendarDays, {
            calendarId: id,
          });

          let cursor = newYearStart;
          for (let index = 0; index < yearCount; index++) {
            const generated = this.buildYearDays(cursor);

            await transactionalEntityManager.save(
              generated.map((day) =>
                transactionalEntityManager.create(CalendarDays, {
                  ...day,
                  ...CalendarService.DEFAULT_DAY_FLAGS,
                  calendarId: id,
                  createdBy: authUser.email,
                }),
              ),
            );

            cursor = this.addDays(generated[generated.length - 1].date, 1);
          }

          return transactionalEntityManager.save(calendar);
        } catch (error) {
          console.error('Failed to update calendar year start:', error);
          if (error instanceof HttpException) {
            throw error;
          }
          throw new InternalServerErrorException(
            'Could not update the year start date. Transaction rolled back',
          );
        }
      },
    );
  }

  async disableCalendar(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const calendar = await this.entityManager.findOne(Calendar, {
      where,
    });

    if (!calendar) {
      throw new NotFoundException(`Calendar with ID ${id} not found`);
    }

    const newIsActiveStatus = !calendar.isActive;

    await this.entityManager.update(Calendar, id, {
      isActive: newIsActiveStatus,
      updatedBy: authUser.email,
    });

    return {
      message: `Calendar status toggled to ${newIsActiveStatus ? 'Active' : 'Inactive'}`,
      newStatus: newIsActiveStatus,
    };
  }

  async deleteCalendar(id: number, authUser: any, activeCompanyId?: number) {
    const where: any = { id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.company = { id: activeCompanyId };
    }

    const calendar = await this.entityManager.findOne(Calendar, { where });
    if (!calendar) {
      throw new NotFoundException(`Calendar with ID ${id} not found`);
    }

    const resourceRepository = this.entityManager.getRepository(Resource);
    const calendarDaysRepository =
      this.entityManager.getRepository(CalendarDays);

    // Concurrently count related entities in all relationships
    const [relatedResourcesCount] = await Promise.all([
      // 1. Check Resource relationship (OneToMany)
      resourceRepository.count({
        where: { calendar: { id } },
      }),
    ]);

    // Sum up all associated records
    const totalAssociatedRecords = relatedResourcesCount;

    // If children exist, return the detailed error message
    if (totalAssociatedRecords > 0) {
      const errorDetails: string[] = [];

      if (relatedResourcesCount > 0) {
        errorDetails.push(`- ${relatedResourcesCount} associated resource(s)`);
      }

      const detailedMessage = `Calendar is currently linked to the following entities:\n${errorDetails.join('\n')}\n\nPlease unassign this calendar from all related records first`;

      return {
        error: 'Cannot delete calendar due to active relationships',
        message: detailedMessage,
        status: 400,
      };
    }

    await calendarDaysRepository.delete({ calendar: { id } });

    // If no children exist, proceed with deletion
    await this.entityManager.delete(Calendar, id);

    return {
      message: 'Calendar deleted',
      status: 200,
    };
  }

  async createSpecialHoliday(
    calendarId: number,
    data: any,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const { date, dayType } = data;

    this.assertNotPast(date);

    const calendarDay = await this.findDayByDate(
      calendarId,
      date,
      activeCompanyId,
    );

    // A special working day is itself an exception on a weekend; turning it
    // straight into a holiday would hide which one is in force. Remove it first.
    if (calendarDay.isSpecialWorkingDay) {
      throw new BadRequestException(
        'This date is a special working day. Remove it before marking it as a holiday',
      );
    }

    const normalizedDayType = this.normalizeDayType(dayType);

    if (calendarDay.isWeekend) {
      const baseType = await this.getWeekendBaseType(calendarId, calendarDay);

      // A full repeated holiday is already a full day off — a holiday on top
      // of it would change nothing.
      if (baseType === DayType.FULL) {
        throw new BadRequestException(
          'Special holidays cannot be applied to a full repeated holiday. Only a special working day can override it',
        );
      }

      // A half repeated holiday can only be turned into a full holiday.
      if (normalizedDayType !== DayType.FULL) {
        throw new BadRequestException(
          'A half repeated holiday can only become a full special holiday',
        );
      }
    }

    // isWeekend is intentionally kept: a holiday landing on a repeated holiday
    // stays flagged as a weekend so clients can tell the two apart.
    Object.assign(
      calendarDay,
      this.composeDayFlags({
        isHoliday: true,
        isWeekend: calendarDay.isWeekend,
        isSpecialWorkingDay: false,
        dayType: normalizedDayType,
      }),
    );
    calendarDay.updatedBy = authUser.email;
    return this.entityManager.save(calendarDay);
  }

  /** Loads one day of a calendar by date, scoped to the active company. */
  private async findDayByDate(
    calendarId: number,
    date: Date | string,
    activeCompanyId?: number,
  ): Promise<CalendarDays> {
    const selectedDate = this.startOfDay(date);

    const where: any = {
      calendarId,
      date: Raw((alias) => `CAST(${alias} AS DATE) = CAST(:date AS DATE)`, {
        date: selectedDate,
      }),
    };

    if (activeCompanyId && activeCompanyId !== 0) {
      where.calendar = { company: { id: activeCompanyId } };
    }

    const calendarDay = await this.entityManager.findOne(CalendarDays, {
      where,
      relations: ['calendar'],
    });

    if (!calendarDay) {
      throw new HttpException(
        `Date ${selectedDate.toLocaleDateString()} not found in calendar ID ${calendarId}. Please ensure the calendar is created for this year`,
        HttpStatus.NOT_FOUND,
      );
    }

    return calendarDay;
  }

  async createRepeatedHoliday(
    calendarId: number,
    data: any,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const { days: selectedDays, year } = data;

    // Verify ownership
    const calendarWhere: any = { id: calendarId };
    if (activeCompanyId && activeCompanyId !== 0) {
      calendarWhere.company = { id: activeCompanyId };
    }
    const calendar = await this.entityManager.findOne(Calendar, {
      where: calendarWhere,
    });
    if (!calendar) {
      throw new NotFoundException('Calendar not found or access denied');
    }

    // The pattern is a weekday -> type map (Mon = 0 ... Sun = 6).
    const pattern = new Map<number, DayType>(
      (selectedDays ?? []).map((selected: any) => [
        Number(selected.day),
        this.normalizeDayType(selected.type),
      ]),
    );

    await this.applyWeekendPattern(
      calendarId,
      pattern,
      authUser,
      year,
      // Weekdays not in the pattern are only reset when the caller is
      // rewriting the whole pattern, which is what this endpoint does.
      true,
    );
  }

  /**
   * Writes a weekday -> type pattern onto every day from today onwards,
   * preserving the exceptions already placed on individual days.
   *
   * A day carrying a special holiday or a special working day keeps it and only
   * gains or loses the weekend flag, so those overrides survive a pattern edit.
   * A special working day whose weekday leaves the pattern loses its basis and
   * falls back to a normal working day.
   */
  private async applyWeekendPattern(
    calendarId: number,
    pattern: Map<number, DayType>,
    authUser: any,
    year?: number,
    resetUnmatched = true,
  ) {
    const today = this.startOfDay(new Date());

    const query = this.entityManager
      .createQueryBuilder(CalendarDays, 'day')
      .where('day."calendarId" = :calendarId', { calendarId })
      // Never touch the past: the pattern applies from today onwards.
      .andWhere('day.date >= :today', { today });

    if (year) {
      query.andWhere('day.year = :year', { year });
    }

    const days = await query.getMany();
    const changed: CalendarDays[] = [];

    for (const day of days) {
      // Monday = 0 ... Sunday = 6, matching the pattern the UI sends.
      const weekDay = (new Date(day.date).getDay() + 6) % 7;
      const isSelected = pattern.has(weekDay);

      if (!isSelected && !resetUnmatched) continue;

      let next: ReturnType<typeof this.composeDayFlags>;

      if (isSelected) {
        const patternType = pattern.get(weekDay)!;

        if (day.isHoliday || day.isSpecialWorkingDay) {
          // Keep the override, just mark the day as part of the pattern.
          next = this.composeDayFlags({
            isHoliday: day.isHoliday,
            isWeekend: true,
            isSpecialWorkingDay: day.isSpecialWorkingDay,
            dayType: day.dayType,
          });
        } else {
          next = this.composeDayFlags({
            isHoliday: false,
            isWeekend: true,
            isSpecialWorkingDay: false,
            dayType: patternType,
          });
        }
      } else if (day.isHoliday) {
        // Holidays outlive the weekend pattern.
        next = this.composeDayFlags({
          isHoliday: true,
          isWeekend: false,
          isSpecialWorkingDay: false,
          dayType: day.dayType,
        });
      } else {
        // Plain day again — a special working day here has nothing to override.
        next = this.composeDayFlags({
          isHoliday: false,
          isWeekend: false,
          isSpecialWorkingDay: false,
          dayType: DayType.FULL,
        });
      }

      const isSame =
        day.isHoliday === next.isHoliday &&
        day.isWeekend === next.isWeekend &&
        day.isWorkingDay === next.isWorkingDay &&
        day.isSpecialWorkingDay === next.isSpecialWorkingDay &&
        day.dayType === next.dayType;

      if (isSame) continue;

      Object.assign(day, next);
      day.updatedBy = authUser.email;
      changed.push(day);
    }

    if (changed.length > 0) {
      await this.entityManager.save(changed, { chunk: 200 });
    }

    return changed.length;
  }

  async createSpecialWorkingDay(
    calendarId: number,
    data: any,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const { date, dayType } = data;

    this.assertNotPast(date);

    const calendarDay = await this.findDayByDate(
      calendarId,
      date,
      activeCompanyId,
    );

    // Special working days only ever override a repeated holiday (weekend).
    if (!calendarDay.isWeekend) {
      throw new BadRequestException(
        'Special working days can only be applied to repeated holiday (weekend) days',
      );
    }

    if (calendarDay.isHoliday) {
      throw new BadRequestException(
        'This date is a special holiday. Remove the holiday before marking it as a special working day',
      );
    }

    const normalizedDayType = this.normalizeDayType(dayType);
    const baseType = await this.getWeekendBaseType(calendarId, calendarDay);

    // Half of a half repeated holiday is already worked, so only a full
    // special working day adds anything.
    if (baseType === DayType.HALF && normalizedDayType !== DayType.FULL) {
      throw new BadRequestException(
        'A half repeated holiday can only become a full special working day',
      );
    }

    Object.assign(
      calendarDay,
      this.composeDayFlags({
        isHoliday: false,
        isWeekend: true,
        isSpecialWorkingDay: true,
        dayType: normalizedDayType,
      }),
    );
    calendarDay.updatedBy = authUser.email;
    return this.entityManager.save(calendarDay);
  }

  getAllCalendar(companyId: number) {
    return this.entityManager.find(Calendar, {
      where: {
        company: { id: companyId },
      },
      order: { id: 'asc' },
    });
  }

  async getAllCalendarDays(id: number, activeCompanyId?: number) {
    const where: any = { calendar: { id } };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.calendar.company = { id: activeCompanyId };
    }

    return this.entityManager.find(CalendarDays, {
      where,
      relations: ['calendar'],
    });
  }

  async getAllSpecialHoliday(id: number, activeCompanyId?: number) {
    const where: any = { calendar: { id }, isHoliday: true };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.calendar.company = { id: activeCompanyId };
    }

    return this.entityManager.find(CalendarDays, {
      where,
      relations: ['calendar'],
    });
  }

  async getAllRepeatedHoliday(
    calendarId: number,
    activeCompanyId?: number,
    year?: number,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to midnight

    const where: any = {
      calendarId,
      isWeekend: true,
      date: MoreThanOrEqual(today),
    };

    if (year) {
      where.year = year;
    }

    if (activeCompanyId && activeCompanyId !== 0) {
      where.calendar = { company: { id: activeCompanyId } };
    }

    const futureDays = await this.entityManager.find(CalendarDays, {
      where,
      relations: ['calendar'],
    });

    // Create a unique list of weekday numbers and their types. Days carrying a
    // special holiday or special working day keep the weekend flag but their
    // dayType belongs to the override, so read the pattern from clean days
    // first and only fall back to an overridden one if that weekday has none.
    const weekdayMap = new Map<number, DayType>();
    const fallbackMap = new Map<number, DayType>();

    for (const day of futureDays) {
      const weekDay = (new Date(day.date).getDay() + 6) % 7; // Monday = 0
      const isOverridden = day.isHoliday || day.isSpecialWorkingDay;

      if (isOverridden) {
        if (!fallbackMap.has(weekDay)) fallbackMap.set(weekDay, day.dayType);
        continue;
      }

      if (!weekdayMap.has(weekDay)) {
        weekdayMap.set(weekDay, day.dayType);
      }
    }

    fallbackMap.forEach((type, weekDay) => {
      if (!weekdayMap.has(weekDay)) weekdayMap.set(weekDay, type);
    });

    // Transform into array
    const selectedDays = Array.from(weekdayMap.entries()).map(
      ([day, type]) => ({
        day,
        type,
      }),
    );

    return selectedDays; // [{ day: 0, type: 'FULL' }, { day: 6, type: 'HALF' }]
  }

  async getAllSpecialWorkingDays(id: number, activeCompanyId?: number) {
    const where: any = { calendar: { id }, isSpecialWorkingDay: true };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.calendar.company = { id: activeCompanyId };
    }

    return this.entityManager.find(CalendarDays, {
      where,
      relations: ['calendar'],
    });
  }

  async deleteHolidaysAndWorkingDays(
    calendarId: number,
    type: string,
    id: number,
    authUser: any,
    activeCompanyId?: number,
  ) {
    const where: any = { calendar: { id: calendarId }, id: id };
    if (activeCompanyId && activeCompanyId !== 0) {
      where.calendar.company = { id: activeCompanyId };
    }

    const calendarDay = await this.entityManager.findOne(CalendarDays, {
      where,
    });
    if (!calendarDay) {
      throw new HttpException(
        'Date not found in calendar',
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertNotPast(calendarDay.date);

    if (type === 'holidays') {
      if (!calendarDay.isHoliday) {
        throw new BadRequestException('This date is not a special holiday');
      }
    } else if (type === 'specialWorkingDay') {
      if (!calendarDay.isSpecialWorkingDay) {
        throw new BadRequestException(
          'This date is not a special working day',
        );
      }
    }

    // Removing an override drops the day back to what the weekday pattern says:
    // the repeated holiday underneath it, or a plain working day.
    const dayType = calendarDay.isWeekend
      ? await this.resolveWeekendBaseType(calendarId, new Date(calendarDay.date))
      : DayType.FULL;

    Object.assign(
      calendarDay,
      this.composeDayFlags({
        isHoliday: false,
        isWeekend: calendarDay.isWeekend,
        isSpecialWorkingDay: false,
        dayType,
      }),
    );

    calendarDay.updatedBy = authUser.email;
    return this.entityManager.save(calendarDay);
  }

  async deleteRepeatedHoliday(
    calendarId: number,
    day: number,
    authUser: any,
    activeCompanyId?: number,
  ) {
    // Verify ownership
    const calendarWhere: any = { id: calendarId };
    if (activeCompanyId && activeCompanyId !== 0) {
      calendarWhere.company = { id: activeCompanyId };
    }
    const calendar = await this.entityManager.findOne(Calendar, {
      where: calendarWhere,
    });
    if (!calendar) {
      throw new NotFoundException('Calendar not found or access denied');
    }

    // Drop just this weekday from the pattern, from today onwards. Days that
    // carry a special holiday keep it; special working days on that weekday
    // lose their basis and become plain working days again.
    const days = await this.entityManager
      .createQueryBuilder(CalendarDays, 'day')
      .where('day."calendarId" = :calendarId', { calendarId })
      .andWhere('day.date >= :today', { today: this.startOfDay(new Date()) })
      .andWhere('EXTRACT(ISODOW FROM day.date) - 1 = :day', { day })
      .getMany();

    const changed: CalendarDays[] = [];
    for (const calendarDay of days) {
      Object.assign(
        calendarDay,
        this.composeDayFlags({
          isHoliday: calendarDay.isHoliday,
          isWeekend: false,
          isSpecialWorkingDay: false,
          dayType: calendarDay.isHoliday ? calendarDay.dayType : DayType.FULL,
        }),
      );
      calendarDay.updatedBy = authUser.email;
      changed.push(calendarDay);
    }

    if (changed.length > 0) {
      await this.entityManager.save(changed, { chunk: 200 });
    }

    return {
      message: 'Repeated holiday deleted',
      status: 200,
    };
  }

  async getActiveCalendarWeeks(companyId: number) {
    const calendar = await this.entityManager.findOne(Calendar, {
      where: { company: { id: companyId }, isActive: true },
    });

    if (!calendar) {
      return [];
    }

    const currentYear = new Date().getFullYear();

    const queryBuilder = this.entityManager
      .createQueryBuilder(CalendarDays, 'cd')
      .select(['cd.weekNumber as "weekNumber"', 'cd.weekStartDate as "weekStartDate"', 'cd.weekEndDate as "weekEndDate"'])
      .where('cd.calendarId = :calendarId', { calendarId: calendar.id })
      .andWhere('cd.year = :year', { year: currentYear })
      .andWhere('cd.weekNumber IS NOT NULL')
      .distinct(true)
      .orderBy('cd.weekNumber', 'ASC');

    const weeks = await queryBuilder.getRawMany();

    console.log("calendarId", calendar.id);
    console.log("year", currentYear);
    console.log("query", queryBuilder.getSql());
    console.log("weeks", weeks);

    return weeks.map(w => ({
      weekNumber: w.weekNumber,
      weekStartDate: w.weekStartDate,
      weekEndDate: w.weekEndDate,
    }));
  }
}
