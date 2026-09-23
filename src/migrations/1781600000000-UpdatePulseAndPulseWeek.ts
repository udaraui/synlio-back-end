import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePulseAndPulseWeek1781600000000
  implements MigrationInterface
{
  name = 'UpdatePulseAndPulseWeek1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Columns from 1780500000000-UpdatePulseWeekAndUser.ts are nullable, update to NOT NULL
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "userEmail" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "userFullName" SET NOT NULL`,
    );

    // pulseWeekId was added in a previous migration, but is nullable. Update to NOT NULL
    await queryRunner.query(
      `ALTER TABLE "pulse" ALTER COLUMN "pulseWeekId" SET NOT NULL`,
    );

    // Add foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "pulse" ADD CONSTRAINT "FK_pulse_pulse_week" FOREIGN KEY ("pulseWeekId") REFERENCES "pulse_week"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse" DROP CONSTRAINT "FK_pulse_pulse_week"`,
    );

    await queryRunner.query(
      `ALTER TABLE "pulse" ALTER COLUMN "pulseWeekId" DROP NOT NULL`,
    );

    // Revert NOT NULL constraints from this migration
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "userFullName" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "userEmail" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "userId" DROP NOT NULL`,
    );
  }
}
