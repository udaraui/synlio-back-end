import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCalendarDays1780041607203 implements MigrationInterface {
  name = 'UpdateCalendarDays1780041607203';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_days" ADD "isSpecialWorkingDay" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP COLUMN "isSpecialWorkingDay"`,
    );
  }
}
