import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePulseWeekAndUser1780500000000 implements MigrationInterface {
  name = 'UpdatePulseWeekAndUser1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pulse_week" ADD "userId" integer`);
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "userEmail" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "userFullName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD CONSTRAINT "FK_pulse_week_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP CONSTRAINT "FK_pulse_week_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "userFullName"`,
    );
    await queryRunner.query(`ALTER TABLE "pulse_week" DROP COLUMN "userEmail"`);
    await queryRunner.query(`ALTER TABLE "pulse_week" DROP COLUMN "userId"`);
  }
}