import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPulseWeekCompositeIndex1784600000000 implements MigrationInterface {
  name = 'AddPulseWeekCompositeIndex1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_pulse_week_user_company_date" ON "pulse_week" ("userId", "companyId", "weekEndDate")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pulse_week_user_company_date"`
    );
  }
}
