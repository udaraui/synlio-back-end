import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPulseWeekRelationsAndColumns1781600000005 implements MigrationInterface {
  name = 'AddPulseWeekRelationsAndColumns1781600000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "pulse_snapshot_status_enum" ADD VALUE IF NOT EXISTS 'APPROVED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "pulse_snapshot_status_enum" ADD VALUE IF NOT EXISTS 'REJECTED'`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "submittedToId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "submittedToEmail" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "submittedToFullName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "submittedToProfilePicture" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "approvedById" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "approvedByEmail" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "approvedByFullName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "approvedByProfilePicture" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "rejectReason" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "responsedAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD CONSTRAINT "FK_pulse_week_submitted_to" FOREIGN KEY ("submittedToId") REFERENCES "resource"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD CONSTRAINT "FK_pulse_week_approved_by" FOREIGN KEY ("approvedById") REFERENCES "resource"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP CONSTRAINT "FK_pulse_week_approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP CONSTRAINT "FK_pulse_week_submitted_to"`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "responsedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "rejectReason"`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "approvedByProfilePicture"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "approvedByFullName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "approvedByEmail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "approvedById"`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "submittedToProfilePicture"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "submittedToFullName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "submittedToEmail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" DROP COLUMN "submittedToId"`,
    );
  }
}
