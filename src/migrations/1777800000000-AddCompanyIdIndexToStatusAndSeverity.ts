import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyIdIndexToStatusAndSeverity1777800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_status_companyId"
      ON "status" ("companyId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_severity_companyId"
      ON "severity" ("companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_status_companyId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_severity_companyId"`);
  }
}

