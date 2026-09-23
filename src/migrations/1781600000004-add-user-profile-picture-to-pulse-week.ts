import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfilePictureToPulseWeek1781600000004 implements MigrationInterface {
  name = 'AddUserProfilePictureToPulseWeek1781600000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "userProfilePicture" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "userProfilePicture"`,
    );
  }
}
