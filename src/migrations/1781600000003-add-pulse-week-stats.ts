import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPulseWeekStats1781600000003 implements MigrationInterface {
  name = 'AddPulseWeekStats1781600000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "synlioActivityTime" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "meetingTime" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "needAttentionCount" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "taskFromMeetingCount" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "missingTime" numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "missingTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "taskFromMeetingCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "needAttentionCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "meetingTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "synlioActivityTime"`,
    );
  }
}
