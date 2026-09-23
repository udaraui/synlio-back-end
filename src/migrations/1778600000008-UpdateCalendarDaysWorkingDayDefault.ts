import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCalendarDaysWorkingDayDefault1778600000008 implements MigrationInterface {
  name = 'UpdateCalendarDaysWorkingDayDefault1778600000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ALTER COLUMN "isWorkingDay" SET DEFAULT true`,
    );

    await queryRunner.query(
      `UPDATE "calendar_days" SET "isWorkingDay" = false WHERE "isHoliday" = true OR "isWeekend" = true`,
    );

    await queryRunner.query(
      `UPDATE "calendar_days" SET "isWorkingDay" = true WHERE ("isHoliday" = false OR "isHoliday" IS NULL) AND ("isWeekend" = false OR "isWeekend" IS NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ALTER COLUMN "isWorkingDay" DROP DEFAULT`,
    );
  }
}
