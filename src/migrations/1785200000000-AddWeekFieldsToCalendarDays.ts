import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeekFieldsToCalendarDays1785200000000
  implements MigrationInterface
{
  name = 'AddWeekFieldsToCalendarDays1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ADD "yearStartDate" date`,
    );
    await queryRunner.query(`ALTER TABLE "calendar_days" ADD "weekNumber" int`);
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ADD "daysOfWeek" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ADD "weekStartDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ADD "weekEndDate" date`,
    );

    // Backfill existing rows. Legacy calendars always start on January 1st of
    // their year, so week 1 starts there and every following week is 7 days on.
    await queryRunner.query(`
      UPDATE "calendar_days"
      SET "yearStartDate"  = ys.year_start,
          "weekNumber"     = ys.week_number,
          "weekStartDate"  = ys.year_start + ((ys.week_number - 1) * 7),
          "weekEndDate"    = ys.year_start + ((ys.week_number - 1) * 7) + 6,
          "daysOfWeek"     = UPPER(TRIM(TO_CHAR("calendar_days"."date", 'DAY')))
      FROM (
        SELECT id,
               MAKE_DATE("year", 1, 1) AS year_start,
               (FLOOR((("date"::date - MAKE_DATE("year", 1, 1)) / 7)) + 1)::int
                 AS week_number
        FROM "calendar_days"
      ) AS ys
      WHERE ys.id = "calendar_days".id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP COLUMN "weekEndDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP COLUMN "weekStartDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP COLUMN "daysOfWeek"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP COLUMN "weekNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP COLUMN "yearStartDate"`,
    );
  }
}
